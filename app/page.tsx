"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNarrator, type NarratorState } from "../hooks/useNarrator";
import {
  validateAnalysisResult,
  type AnalysisErrorCode,
  type AnalysisResult,
  type Claim,
  type Language,
  type ResearchSource,
} from "../lib/analysis";
import { countCharacters, limitCharacters } from "../lib/text";

type SupportId = "supports" | "partial" | "does_not_support" | "insufficient";
type ActionId = "correct" | "context" | "remove" | "transparent" | "research";
type ReflectionId = "narrowed" | "context" | "uncertainty" | "removed" | "research";

const MAX_CHARACTERS = 1500;

const tr = (language: Language, pt: string, en: string) => language === "pt" ? pt : en;

const demoDraft: Record<Language, string> = {
  en: "UNESCO proved that most digital creators spread misinformation because 62% never verify facts. This means creators are less reliable than journalists.",
  pt: "A UNESCO provou que a maioria dos criadores digitais espalha desinformação porque 62% nunca verificam os fatos. Isso significa que criadores são menos confiáveis que jornalistas.",
};

const demoRevision: Record<Language, string> = {
  en: "In a UNESCO survey of 500 digital content creators from 45 countries, 62% reported that they did not conduct rigorous and systematic fact-checking before sharing content. The result highlights a need for training, but it does not prove that creators intentionally spread misinformation or that they are less reliable than journalists.",
  pt: "Em uma pesquisa da UNESCO com 500 criadores de conteúdo digital de 45 países, 62% informaram que não realizavam uma verificação rigorosa e sistemática antes de compartilhar conteúdo. O resultado indica uma necessidade de capacitação, mas não prova que os criadores espalhem desinformação intencionalmente nem que sejam menos confiáveis que jornalistas.",
};

const demoSourceUrl = "https://www.unesco.org/en/articles/2/3-digital-content-creators-do-not-check-their-facts-sharing-want-learn-how-do-so-unesco-survey";

const demoData: Record<Language, AnalysisResult> = {
  en: {
    mode: "demo",
    language: "en",
    searchedAt: "2024-11-26T00:00:00.000Z",
    researchSummary: "Guided demonstration based on UNESCO's published survey summary. This is prepared learning content, not a live search.",
    sources: [{
      id: "unesco-1",
      title: "2/3 of digital content creators do not check their facts before sharing",
      url: demoSourceUrl,
      publisher: "UNESCO",
      publishedAt: "2024",
      excerpt: "UNESCO reports a survey of 500 creators in 45 countries about fact-checking practices and training needs.",
      relevance: "The source reports verification practices, but it does not measure how much misinformation creators publish or compare their reliability with journalists.",
    }],
    claims: [
      { id: "claim-1", text: "UNESCO proved that most digital creators spread misinformation.", category: "Unsupported conclusion", reason: "The survey measured verification practices—not how much misinformation creators spread.", question: "What exactly did the UNESCO survey measure?", tone: "amber", sourceIds: ["unesco-1"] },
      { id: "claim-2", text: "62% never verify facts.", category: "Misrepresented statistic", reason: "The source says 62% did not conduct rigorous, systematic fact-checking. It does not say they never check facts.", question: "Does the word “never” match the source's wording?", tone: "violet", sourceIds: ["unesco-1"] },
      { id: "claim-3", text: "Creators are less reliable than journalists.", category: "Unsupported comparison", reason: "The survey did not compare creators with journalists or measure either group's reliability.", question: "Which evidence supports this comparison?", tone: "teal", sourceIds: ["unesco-1"] },
    ],
  },
  pt: {
    mode: "demo",
    language: "pt",
    searchedAt: "2024-11-26T00:00:00.000Z",
    researchSummary: "Demonstração guiada baseada no resumo publicado pela UNESCO. Este é um conteúdo educativo preparado, não uma pesquisa ao vivo.",
    sources: [{
      id: "unesco-1",
      title: "Dois em cada três criadores digitais não verificam os fatos antes de compartilhar",
      url: demoSourceUrl,
      publisher: "UNESCO",
      publishedAt: "2024",
      excerpt: "A UNESCO apresenta uma pesquisa com 500 criadores de 45 países sobre práticas de verificação e necessidades de capacitação.",
      relevance: "A fonte informa práticas de verificação, mas não mede quanta desinformação os criadores publicam nem compara sua confiabilidade com a de jornalistas.",
    }],
    claims: [
      { id: "claim-1", text: "A UNESCO provou que a maioria dos criadores digitais espalha desinformação.", category: "Conclusão sem apoio", reason: "A pesquisa mediu práticas de verificação — não a quantidade de desinformação divulgada.", question: "O que a pesquisa da UNESCO realmente mediu?", tone: "amber", sourceIds: ["unesco-1"] },
      { id: "claim-2", text: "62% nunca verificam os fatos.", category: "Estatística distorcida", reason: "A fonte afirma que 62% não faziam verificação rigorosa e sistemática. Ela não diz que nunca verificavam nada.", question: "A palavra “nunca” corresponde ao texto da fonte?", tone: "violet", sourceIds: ["unesco-1"] },
      { id: "claim-3", text: "Criadores são menos confiáveis que jornalistas.", category: "Comparação sem apoio", reason: "A pesquisa não comparou criadores e jornalistas nem mediu a confiabilidade dos grupos.", question: "Qual evidência sustenta essa comparação?", tone: "teal", sourceIds: ["unesco-1"] },
    ],
  },
};

const supportOptions: Record<Language, Array<{ id: SupportId; label: string }>> = {
  en: [
    { id: "supports", label: "Supports" },
    { id: "partial", label: "Partially supports" },
    { id: "does_not_support", label: "Does not support" },
    { id: "insufficient", label: "Not enough information" },
  ],
  pt: [
    { id: "supports", label: "Sustenta" },
    { id: "partial", label: "Sustenta parcialmente" },
    { id: "does_not_support", label: "Não sustenta" },
    { id: "insufficient", label: "Informações insuficientes" },
  ],
};

const actionOptions: Record<Language, Array<{ id: ActionId; title: string; description: string; icon: string }>> = {
  en: [
    { id: "correct", title: "Correct the claim", description: "Narrow or correct what the content asserts.", icon: "✎" },
    { id: "context", title: "Add context", description: "Explain what the source measured—and what it did not.", icon: "+" },
    { id: "remove", title: "Remove the claim", description: "Take out a conclusion the evidence cannot support.", icon: "−" },
    { id: "transparent", title: "Keep with transparency", description: "Keep it while stating the evidence limitation.", icon: "◌" },
    { id: "research", title: "Find better evidence", description: "Pause publication and look for stronger support.", icon: "⌕" },
  ],
  pt: [
    { id: "correct", title: "Corrigir a afirmação", description: "Reduza ou corrija o que o conteúdo afirma.", icon: "✎" },
    { id: "context", title: "Adicionar contexto", description: "Explique o que a fonte mediu — e o que não mediu.", icon: "+" },
    { id: "remove", title: "Remover a afirmação", description: "Retire uma conclusão que a evidência não sustenta.", icon: "−" },
    { id: "transparent", title: "Manter com transparência", description: "Mantenha informando a limitação da evidência.", icon: "◌" },
    { id: "research", title: "Buscar evidência melhor", description: "Pause a publicação e procure um apoio mais forte.", icon: "⌕" },
  ],
};

const reflectionOptions: Record<Language, Array<{ id: ReflectionId; label: string }>> = {
  en: [
    { id: "narrowed", label: "I narrowed the claim" },
    { id: "context", label: "I added missing context" },
    { id: "uncertainty", label: "I acknowledged uncertainty" },
    { id: "removed", label: "I removed an unsupported conclusion" },
    { id: "research", label: "I decided to find better evidence" },
  ],
  pt: [
    { id: "narrowed", label: "Reduzi a afirmação" },
    { id: "context", label: "Adicionei o contexto ausente" },
    { id: "uncertainty", label: "Reconheci a incerteza" },
    { id: "removed", label: "Removi uma conclusão sem apoio" },
    { id: "research", label: "Decidi buscar evidências melhores" },
  ],
};

function analysisErrorMessage(language: Language, code: AnalysisErrorCode | null) {
  switch (code) {
    case "CONFIGURATION_ERROR":
      return tr(language, "A pesquisa ao vivo ainda não foi configurada. Adicione a chave do serviço na Vercel para ativá-la.", "Live research has not been configured yet. Add the service key in Vercel to enable it.");
    case "NO_VERIFIABLE_CLAIMS":
      return tr(language, "Não encontramos uma afirmação verificável clara. Inclua um dado, comparação ou conclusão factual e tente novamente.", "We could not find a clear verifiable claim. Add a statistic, comparison, or factual conclusion and try again.");
    case "NO_VERIFIED_SOURCES":
      return tr(language, "A pesquisa não encontrou fontes verificáveis suficientes. Nenhuma resposta simulada foi exibida.", "The research did not find enough verifiable sources. No simulated answer was displayed.");
    case "INVALID_REQUEST":
      return tr(language, "Revise o rascunho e tente novamente.", "Review the draft and try again.");
    default:
      return tr(language, "Não foi possível concluir a pesquisa agora. Tente novamente em alguns instantes.", "The research could not be completed right now. Please try again shortly.");
  }
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
  const [action, setAction] = useState<ActionId | "">("");
  const [revised, setRevised] = useState("");
  const [reflection, setReflection] = useState<ReflectionId | "">("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [researching, setResearching] = useState(false);
  const [analysisError, setAnalysisError] = useState<AnalysisErrorCode | null>(null);
  const [needsResearchRefresh, setNeedsResearchRefresh] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const narrator = useNarrator(language);
  const characterCount = countCharacters(draft, language);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

  useEffect(() => () => requestController.current?.abort(), []);

  const claims = analysis?.claims ?? [];
  const claim = claims.find((item) => item.id === selectedClaimId) ?? claims[0];
  const relatedSources = useMemo(() => {
    if (!analysis || !claim) return [];
    return analysis.sources.filter((source) => claim.sourceIds.includes(source.id));
  }, [analysis, claim]);
  const source = relatedSources.find((item) => item.id === selectedSourceId) ?? relatedSources[0] ?? analysis?.sources[0];
  const supportLabel = supportOptions[language].find((item) => item.id === support)?.label ?? "";
  const actionLabel = actionOptions[language].find((item) => item.id === action)?.title ?? "";
  const reflectionLabel = reflectionOptions[language].find((item) => item.id === reflection)?.label ?? "";
  const labels = language === "pt" ? ["Rascunho", "Afirmação", "Evidência", "Decisão", "Recibo"] : ["Draft", "Claim", "Evidence", "Decision", "Receipt"];

  function chooseClaim(item: Claim) {
    setSelectedClaimId(item.id);
    setSelectedSourceId(item.sourceIds[0] ?? "");
    setSupport("");
  }

  function resetReview() {
    requestController.current?.abort();
    requestController.current = null;
    setResearching(false);
    setSelectedClaimId("");
    setSelectedSourceId("");
    setSupport("");
    setAction("");
    setRevised("");
    setReflection("");
    setSourceNotes("");
    setCopied(false);
    setAnalysisError(null);
    setNeedsResearchRefresh(false);
    narrator.stop();
  }

  function start(isGuided: boolean) {
    resetReview();
    setGuided(isGuided);
    setDraft(isGuided ? demoDraft[language] : "");
    setAnalysis(isGuided ? demoData[language] : null);
    setStep(1);
  }

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    requestController.current?.abort();
    requestController.current = null;
    setResearching(false);
    narrator.stop();
    setLanguage(nextLanguage);
    if (guided) {
      setDraft(demoDraft[nextLanguage]);
      setAnalysis(demoData[nextLanguage]);
      setSelectedClaimId("");
      setSelectedSourceId("");
      setRevised("");
      setSupport("");
      setAction("");
      setReflection("");
      setNeedsResearchRefresh(false);
    } else if (analysis?.mode === "live") {
      setAnalysis(null);
      setSelectedClaimId("");
      setSelectedSourceId("");
      setSupport("");
      setAction("");
      setRevised("");
      setReflection("");
      setSourceNotes("");
      setAnalysisError(null);
      setNeedsResearchRefresh(true);
      setStep(1);
    }
  }

  function updateDraft(value: string) {
    setDraft(limitCharacters(value, MAX_CHARACTERS, language));
    if (guided) {
      setGuided(false);
      setAnalysis(null);
    }
    setAnalysisError(null);
    setNeedsResearchRefresh(false);
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
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: draft.trim(), language }),
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !validateAnalysisResult(result)) {
        const code = result && typeof result === "object" && "code" in result ? String(result.code) : "UPSTREAM_ERROR";
        setAnalysisError(code as AnalysisErrorCode);
        return;
      }
      setAnalysis(result);
      setSelectedClaimId(result.claims[0].id);
      setSelectedSourceId(result.claims[0].sourceIds[0] ?? "");
      setStep(2);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnalysisError("UPSTREAM_ERROR");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setResearching(false);
      }
    }
  }

  const receiptTitle = tr(language, "Recibo de Evidências", "Evidence Receipt");
  const receiptSummary = `${tr(language, "Afirmação examinada", "Claim examined")}: ${claim?.text ?? "—"}\n${tr(language, "Fonte", "Source")}: ${source?.publisher ?? "—"} — ${source?.title ?? "—"}\n${tr(language, "Endereço da fonte", "Source URL")}: ${source?.url ?? "—"}\n${tr(language, "Relação", "Relationship")}: ${supportLabel || "—"}\n${tr(language, "Decisão", "Decision")}: ${actionLabel || "—"}\n${tr(language, "Reflexão", "Reflection")}: ${reflectionLabel || "—"}`;

  async function copyReceipt() {
    await navigator.clipboard.writeText(receiptSummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadReceipt() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f7f9ff";
    ctx.fillRect(0, 0, 1200, 1500);
    ctx.fillStyle = "#5c57e7";
    ctx.fillRect(0, 0, 1200, 18);
    ctx.fillStyle = "#101e3b";
    ctx.font = "700 58px Arial";
    ctx.fillText(receiptTitle, 80, 115);
    ctx.font = "24px Arial";
    ctx.fillStyle = "#667085";
    ctx.fillText(tr(language, "Registro das decisões de verificação antes da publicação", "A record of verification decisions made before publication"), 80, 160);
    const sections = [
      [tr(language, "AFIRMAÇÃO EXAMINADA", "CLAIM EXAMINED"), claim?.text],
      [tr(language, "FONTE CONSULTADA", "SOURCE CONSULTED"), `${source?.publisher ?? "—"} · ${source?.title ?? "—"} · ${source?.publishedAt ?? "—"}`],
      [tr(language, "RELAÇÃO COM A EVIDÊNCIA", "EVIDENCE RELATIONSHIP"), supportLabel],
      [tr(language, "DECISÃO EDITORIAL", "EDITORIAL DECISION"), actionLabel],
      [tr(language, "REFLEXÃO", "REFLECTION"), reflectionLabel || "—"],
    ];
    let y = 245;
    for (const [title, body] of sections) {
      ctx.font = "700 18px Arial";
      ctx.fillStyle = "#5c57e7";
      ctx.fillText(title ?? "", 80, y);
      y += 38;
      ctx.font = "28px Arial";
      ctx.fillStyle = "#26324b";
      y = wrapCanvasText(ctx, body || "—", 80, y, 1020, 40) + 54;
    }
    ctx.fillStyle = "#101e3b";
    ctx.fillRect(70, 1300, 1060, 125);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 22px Arial";
    ctx.fillText(tr(language, "Este recibo não certifica que o conteúdo é verdadeiro.", "This receipt does not certify that the content is true."), 105, 1355);
    ctx.font = "19px Arial";
    ctx.fillStyle = "#cbd5e7";
    ctx.fillText(tr(language, "Ele documenta o processo de verificação do criador.", "It documents the creator's verification process."), 105, 1392);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = language === "pt" ? "recibo-de-evidencias.png" : "evidence-receipt.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  if (step === 0) return <Landing language={language} setLanguage={changeLanguage} start={start} />;

  return (
    <main className="app-shell editor-page">
      <Header language={language} setLanguage={changeLanguage} home={() => setStep(0)} compact />
      <Progress step={step} labels={labels} language={language} />

      {step === 1 && <>
        <StepIntro eyebrow={tr(language, "ETAPA 1 DE 5", "STEP 1 OF 5")} title={tr(language, "Revise antes de publicar", "Review before you publish")} lead={tr(language, "Cole uma legenda, roteiro ou publicação. A pesquisa ao vivo encontrará até três afirmações e fontes reais para você examinar.", "Paste a caption, script, or post. Live research will find up to three claims and real sources for you to examine.")} />
        <section className="editor-grid">
          <div className="draft-card">
            <label htmlFor="draft">{tr(language, "SEU RASCUNHO", "YOUR DRAFT")}</label>
            <textarea id="draft" aria-label={tr(language, "Seu rascunho", "Your draft")} value={draft} placeholder={tr(language, "Cole seu rascunho aqui…", "Paste your draft here…")} onChange={(event) => updateDraft(event.target.value)} autoFocus />
            <div className={`draft-meta ${characterCount >= 1400 ? "near-limit" : ""}`}>
              <span>{tr(language, "Máximo de 1.500 caracteres", "Maximum 1,500 characters")}</span>
              <strong aria-live="polite">{formatNumber(language, characterCount)} / {formatNumber(language, MAX_CHARACTERS)}</strong>
            </div>
          </div>
          <InfoCard language={language} />
        </section>
        {needsResearchRefresh && <div className="translation-notice" role="status"><span>i</span><p>{tr(language, "A interface foi traduzida. Execute a pesquisa novamente para gerar explicações e fontes no idioma selecionado.", "The interface was translated. Run the research again to generate explanations and sources in the selected language.")}</p></div>}
        {analysisError && <div className="analysis-error" role="alert"><span>!</span><div><strong>{tr(language, "A pesquisa não foi concluída", "Research was not completed")}</strong><p>{analysisErrorMessage(language, analysisError)}</p><button onClick={() => start(true)}>{tr(language, "Abrir demonstração guiada", "Open guided demonstration")}</button></div></div>}
        <Actions back={() => setStep(0)} language={language}>
          <button className="text-button example-link" onClick={() => start(true)}>{tr(language, "Usar exemplo guiado", "Use guided example")}</button>
          <button className="primary-button" disabled={!draft.trim() || researching} onClick={analyzeDraft} aria-busy={researching}>
            {researching ? tr(language, "Pesquisando fontes…", "Researching sources…") : guided ? tr(language, "Analisar demonstração", "Analyze demonstration") : tr(language, "Pesquisar e encontrar afirmações", "Research and find claims")}
            <span>{researching ? "…" : "→"}</span>
          </button>
        </Actions>
      </>}

      {step === 2 && analysis && <>
        <StepIntro eyebrow={tr(language, "ETAPA 2 DE 5", "STEP 2 OF 5")} title={tr(language, "Qual afirmação merece mais atenção?", "Which claim deserves the most attention?")} lead={tr(language, "Escolha uma afirmação para investigar. A ferramenta mostra o contexto; a prioridade continua sendo sua.", "Choose one claim to investigate. The tool shows context; the priority remains yours.")} />
        <ResearchBanner analysis={analysis} language={language} onListen={() => narrator.speak(analysis.researchSummary)} narratorState={narrator.state} stop={narrator.stop} />
        <NarrationStatus state={narrator.state} language={language} voiceName={narrator.voiceName} />
        <section className="claims-grid">{claims.map((item, index) => <article role="button" tabIndex={0} aria-pressed={claim?.id === item.id} key={item.id} className={`claim-card ${item.tone} ${claim?.id === item.id ? "selected" : ""}`} onClick={() => chooseClaim(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseClaim(item); } }}><div className="claim-head"><span>{String(index + 1).padStart(2, "0")}</span><b>{item.category}</b><i>{claim?.id === item.id ? "✓" : ""}</i></div><blockquote>“{item.text}”</blockquote><div className="claim-reason"><small>{tr(language, "POR QUE MERECE ATENÇÃO", "WHY IT NEEDS ATTENTION")}</small><p>{item.reason}</p></div><div className="claim-question"><span>?</span><p>{item.question}</p><button aria-label={tr(language, "Ouvir pergunta", "Listen to question")} title={tr(language, "Ouvir pergunta", "Listen to question")} onClick={(event) => { event.stopPropagation(); narrator.speak(item.question); }}>🔊</button></div></article>)}</section>
        <Actions back={() => setStep(1)} language={language}><button className="primary-button" onClick={() => { setSelectedSourceId(claim?.sourceIds[0] ?? ""); setStep(3); }}>{tr(language, "Examinar esta afirmação", "Examine this claim")}<span>→</span></button></Actions>
      </>}

      {step === 3 && analysis && claim && <>
        <StepIntro eyebrow={tr(language, "ETAPA 3 DE 5", "STEP 3 OF 5")} title={tr(language, "O que a evidência realmente sustenta?", "What does the evidence really support?")} lead={tr(language, "Abra as fontes, confira a origem e examine o que foi medido antes de escolher uma resposta.", "Open the sources, check their origin, and examine what was measured before choosing an answer.")} />
        <section className="evidence-grid">
          <div className="evidence-panel">
            <span className="panel-label">{tr(language, "AFIRMAÇÃO ESCOLHIDA", "SELECTED CLAIM")}</span>
            <blockquote>“{claim.text}”</blockquote>
            <div className="source-heading"><div><span className="panel-label">{tr(language, "FONTES ENCONTRADAS NA PESQUISA", "SOURCES FOUND IN RESEARCH")}</span><p>{tr(language, "Clique em uma fonte para examinar os detalhes. O link abre a página original.", "Select a source to examine its details. The link opens the original page.")}</p></div><strong>{relatedSources.length}</strong></div>
            <div className="source-results">{relatedSources.map((item) => <button key={item.id} className={`source-result ${source?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedSourceId(item.id)}><span>{item.publisher}</span><strong>{item.title}</strong><small>{item.publishedAt || tr(language, "Data não informada", "Date not provided")}</small></button>)}</div>
            {source && <SourceDetails source={source} language={language} />}
            <label className="source-notes">{tr(language, "SUAS ANOTAÇÕES SOBRE A FONTE", "YOUR NOTES ABOUT THE SOURCE")}<textarea value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} placeholder={tr(language, "Registre limitações, contexto ou dúvidas…", "Record limitations, context, or questions…")} /></label>
          </div>
          <aside className="support-panel"><span className="panel-label">{tr(language, "SUA AVALIAÇÃO", "YOUR ASSESSMENT")}</span><h2>{tr(language, "A fonte sustenta a afirmação completa?", "Does the source support the complete claim?")}</h2><div className="support-options">{supportOptions[language].map((item) => <button key={item.id} className={support === item.id ? "selected" : ""} onClick={() => setSupport(item.id)}><i>{support === item.id ? "✓" : ""}</i>{item.label}</button>)}</div><button className="listen-link" onClick={() => narrator.state === "speaking" ? narrator.stop() : narrator.speak(`${claim.question} ${source?.relevance ?? ""}`)}>{narrator.state === "speaking" ? `■ ${tr(language, "Parar narração", "Stop narration")}` : `🔊 ${tr(language, "Ouvir pergunta e contexto", "Listen to question and context")}`}</button><NarrationStatus state={narrator.state} language={language} voiceName={narrator.voiceName} compact /><div className="human-note">{tr(language, "A plataforma apresenta fontes e explica limites, mas não escolhe por você.", "The platform presents sources and explains limitations, but does not choose for you.")}</div></aside>
        </section>
        <Actions back={() => setStep(2)} language={language}><button className="primary-button" disabled={!support || !source} onClick={() => setStep(4)}>{tr(language, "Continuar para a decisão", "Continue to decision")}<span>→</span></button></Actions>
      </>}

      {step === 4 && <>
        <StepIntro eyebrow={tr(language, "ETAPA 4 DE 5", "STEP 4 OF 5")} title={tr(language, "O que você fará antes de publicar?", "What will you do before publishing?")} lead={tr(language, "Você continua responsável pela decisão editorial final.", "You remain responsible for the final editorial decision.")} />
        <section className="decision-grid">{actionOptions[language].map((item) => <button key={item.id} className={action === item.id ? "selected" : ""} onClick={() => setAction(item.id)}><span>{item.icon}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><i>{action === item.id ? "✓" : "→"}</i></button>)}</section>
        <div className="responsibility-note"><span>!</span><p><strong>{tr(language, "A decisão é sua.", "The decision is yours.")}</strong> {tr(language, "O Proof Before Post orienta seu raciocínio; não aprova a publicação.", "Proof Before Post guides your reasoning; it does not approve publication.")}</p></div>
        <Actions back={() => setStep(3)} language={language}><button className="primary-button" disabled={!action} onClick={() => { setRevised(draft); setStep(5); }}>{tr(language, "Revisar o conteúdo", "Revise the content")}<span>→</span></button></Actions>
      </>}

      {step === 5 && <>
        <StepIntro eyebrow={tr(language, "REVISÃO FINAL", "FINAL REVISION")} title={tr(language, "Torne a mudança visível", "Make the change visible")} lead={tr(language, "Edite com suas próprias palavras e registre o que mudou na sua conclusão.", "Edit in your own words and record what changed in your conclusion.")} />
        <section className="revision-grid"><div className="version-card original"><span>{tr(language, "RASCUNHO ORIGINAL", "ORIGINAL DRAFT")}</span><p>{draft}</p></div><div className="version-card revised"><div className="version-label"><span>{tr(language, "VERSÃO REVISADA", "REVISED DRAFT")}</span>{guided && <button onClick={() => setRevised(demoRevision[language])}>{tr(language, "Usar revisão demonstrativa", "Use transparent demo revision")}</button>}</div><textarea value={revised} onChange={(event) => setRevised(limitCharacters(event.target.value, MAX_CHARACTERS, language))} aria-label={tr(language, "Versão revisada", "Revised draft")} /></div></section>
        <section className="reflection-card"><label>{tr(language, "O que mudou na sua conclusão?", "What changed in your conclusion?")}</label><div>{reflectionOptions[language].map((item) => <button key={item.id} className={reflection === item.id ? "selected" : ""} onClick={() => setReflection(item.id)}>{reflection === item.id ? "✓ " : ""}{item.label}</button>)}</div></section>
        <Actions back={() => setStep(4)} language={language}><button className="primary-button" disabled={!revised.trim() || !reflection} onClick={() => setStep(6)}>{tr(language, "Criar meu Recibo de Evidências", "Create my Evidence Receipt")}<span>→</span></button></Actions>
      </>}

      {step === 6 && <>
        <StepIntro eyebrow={tr(language, "ETAPA 5 DE 5", "STEP 5 OF 5")} title={tr(language, "Seu processo, documentado", "Your process, documented")} lead={tr(language, "Um registro transparente das decisões tomadas antes da publicação.", "A transparent record of the decisions made before publication.")} />
        <section className="receipt-wrap"><article className="receipt-card" id="receipt"><div className="receipt-header"><div><span className="brand-mark"><span /></span><div><h2>{receiptTitle}</h2><p>{tr(language, "Registro de verificação pré-publicação", "Pre-publication verification record")}</p></div></div><time>{new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US").format(new Date())}</time></div><div className="receipt-section"><span>{tr(language, "AFIRMAÇÃO EXAMINADA", "CLAIM EXAMINED")}</span><blockquote>“{claim?.text}”</blockquote></div><div className="receipt-two"><div><span>{tr(language, "FONTE CONSULTADA", "SOURCE CONSULTED")}</span><strong>{source?.publisher ?? "—"}</strong><p>{source?.title ?? "—"} · {source?.publishedAt || "—"}</p>{source?.url && <a href={source.url} target="_blank" rel="noreferrer">{tr(language, "Abrir fonte original ↗", "Open original source ↗")}</a>}</div><div><span>{tr(language, "RELAÇÃO", "RELATIONSHIP")}</span><strong>{supportLabel}</strong><p>{tr(language, "Avaliação feita pelo criador", "Assessment made by the creator")}</p></div></div><div className="receipt-two"><div><span>{tr(language, "DECISÃO EDITORIAL", "EDITORIAL DECISION")}</span><strong>{actionLabel}</strong></div><div><span>{tr(language, "APRENDIZADO", "LEARNING")}</span><strong>{reflectionLabel}</strong></div></div><div className="receipt-change"><span>{tr(language, "MUDANÇA REALIZADA", "CHANGE MADE")}</span><div><p>{draft}</p><i>→</i><p>{revised}</p></div></div><div className="receipt-disclaimer"><span>i</span><p><strong>{tr(language, "Este recibo não certifica que o conteúdo é verdadeiro.", "This receipt does not certify that the content is true.")}</strong><br />{tr(language, "Ele documenta o processo de verificação e as decisões do criador.", "It documents the creator's verification process and decisions.")}</p></div></article><aside className="receipt-actions"><h3>{tr(language, "Pronto para compartilhar o processo", "Ready to share the process")}</h3><p>{tr(language, "Baixe o recibo como imagem ou copie um resumo. O conteúdo continua sendo sua responsabilidade.", "Download the receipt as an image or copy a summary. You remain responsible for the content.")}</p><button className="primary-button" onClick={downloadReceipt}>↓ {tr(language, "Baixar como imagem", "Download as image")}</button><button className="secondary-button" onClick={copyReceipt}>{copied ? tr(language, "Resumo copiado ✓", "Summary copied ✓") : tr(language, "Copiar resumo", "Copy summary")}</button><button className="text-button" onClick={() => start(false)}>{tr(language, "Revisar outro rascunho", "Review another draft")}</button></aside></section>
      </>}
    </main>
  );
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) { const words = text.split(" "); let line = ""; for (const word of words) { const test = `${line}${word} `; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, y); line = `${word} `; y += lineHeight; } else line = test; } ctx.fillText(line, x, y); return y; }

function formatNumber(language: Language, value: number) { return new Intl.NumberFormat(language === "pt" ? "pt-BR" : "en-US").format(value); }

function Header({ language, setLanguage, home, compact = false }: { language: Language; setLanguage: (value: Language) => void; home: () => void; compact?: boolean }) { return <header className={`site-header ${compact ? "compact" : ""}`}><button className="brand" onClick={home} aria-label={tr(language, "Início do Proof Before Post", "Proof Before Post home")}><span className="brand-mark"><span /></span><span>Proof Before Post</span></button>{!compact && <nav aria-label={tr(language, "Navegação principal", "Main navigation")}><a href="#how">{tr(language, "Como funciona", "How it works")}</a><a href="#why">{tr(language, "Por que importa", "Why it matters")}</a></nav>}<div className="header-actions">{!compact && <span className="privacy-pill"><i />{tr(language, "Privacidade desde o início", "Private by design")}</span>}<div className="language-toggle" aria-label={tr(language, "Idioma", "Language")}><button className={language === "pt" ? "active" : ""} aria-pressed={language === "pt"} onClick={() => setLanguage("pt")}>PT</button><button className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button></div></div></header>; }

function Landing({ language, setLanguage, start }: { language: Language; setLanguage: (value: Language) => void; start: (guided: boolean) => void }) { return <main className="app-shell home-page"><Header language={language} setLanguage={setLanguage} home={() => undefined} /><section className="hero"><div className="hero-copy"><p className="eyebrow"><span />{tr(language, "Educação Midiática e Informacional", "Media & Information Literacy")}</p><h1><span>{tr(language, "Pare.", "Pause.")}</span><br />{tr(language, "Confira as evidências.", "Check the evidence.")}<br /><em>{tr(language, "Depois publique.", "Then post.")}</em></h1><p className="hero-subtitle">{tr(language, "Uma prática guiada que ajuda jovens criadores a fortalecer as evidências de seus conteúdos — sem deixar a tecnologia decidir a verdade por eles.", "A guided practice that helps young creators strengthen the evidence behind their content—without letting technology decide the truth for them.")}</p><div className="hero-actions"><button className="primary-button" onClick={() => start(true)}>{tr(language, "Testar o exemplo guiado", "Try the guided example")}<span>→</span></button><button className="secondary-button" onClick={() => start(false)}>{tr(language, "Revisar meu rascunho", "Review my own draft")}</button></div><div className="trust-row"><span>✓ {tr(language, "Sem cadastro", "No account required")}</span><span>✓ {tr(language, "Sem armazenamento permanente", "No permanent draft storage")}</span><span>✓ {tr(language, "Fontes reais na pesquisa ao vivo", "Real sources in live research")}</span></div></div><HeroVisual language={language} /></section><section className="proof-strip" id="why"><div className="stat-block"><strong>62<span>%</span></strong><p>{tr(language, "dos criadores pesquisados pela UNESCO não realizavam uma verificação rigorosa e sistemática antes de compartilhar conteúdo.", "of creators surveyed by UNESCO did not conduct rigorous, systematic fact-checking before sharing content.")}</p></div><div className="source-block"><span>↗</span><div><strong>{tr(language, "Pesquisa UNESCO · 500 criadores · 45 países", "UNESCO survey · 500 creators · 45 countries")}</strong><small>{tr(language, "O problema existe. A decisão continua sendo humana.", "The problem is real. The decision remains human.")}</small></div></div></section><section className="how-section" id="how"><div><p className="eyebrow"><span />{tr(language, "COMO FUNCIONA", "HOW IT WORKS")}</p><h2>{tr(language, "Uma decisão que ainda pode mudar", "A decision you can still change")}</h2><p>{tr(language, "O Proof Before Post intervém antes que o conteúdo chegue ao público.", "Proof Before Post intervenes before content reaches an audience.")}</p></div><div className="step-row"><article><span>01</span><div className="step-symbol">“ ”</div><h3>{tr(language, "Encontre a afirmação", "Spot the claim")}</h3></article><article><span>02</span><div className="step-symbol">⌕</div><h3>{tr(language, "Examine as fontes", "Examine the sources")}</h3></article><article><span>03</span><div className="step-symbol">✓</div><h3>{tr(language, "Tome sua decisão", "Make your decision")}</h3></article></div></section></main>; }

function HeroVisual({ language }: { language: Language }) { return <div className="hero-visual" aria-label={tr(language, "Ilustração de revisão de evidências", "Evidence review illustration")}><div className="visual-glow" /><div className="evidence-card card-back"><div className="fake-lines"><i /><i /><i /></div></div><div className="evidence-card card-main"><div className="card-top"><span className="doc-icon">▤</span><span>{tr(language, "RASCUNHO", "DRAFT")}</span><i>•••</i></div><p>{tr(language, "“A UNESCO provou que a maioria dos criadores espalha desinformação...”", "“UNESCO proved that most creators spread misinformation...”")}</p><div className="claim-callout"><span>!</span><div><strong>{tr(language, "CONCLUSÃO SEM APOIO", "UNSUPPORTED CONCLUSION")}</strong><small>{tr(language, "O que a fonte realmente mediu?", "What did the source actually measure?")}</small></div></div><div className="card-status"><span>01</span><i /><b>{tr(language, "AFIRMAÇÃO ENCONTRADA", "CLAIM FOUND")}</b></div></div><div className="receipt-mini"><span className="check">✓</span><div><strong>{tr(language, "FONTE EXAMINADA", "SOURCE EXAMINED")}</strong><small>{tr(language, "Contexto adicionado antes de publicar", "Context added before publishing")}</small></div></div></div>; }

function Progress({ step, labels, language }: { step: number; labels: string[]; language: Language }) { const current = step === 5 ? 4 : Math.min(step, 5); return <div className="progress-wrap" aria-label={tr(language, "Progresso da revisão", "Review progress")}>{labels.map((label, index) => <div className="progress-fragment" key={label}><div className={`progress-label ${index + 1 <= current ? "done" : "muted"}`}><strong>{index + 1 < current ? "✓" : String(index + 1).padStart(2, "0")}</strong><span>{label}</span></div>{index < labels.length - 1 && <div className={`progress-line ${index + 1 < current ? "filled" : ""}`} />}</div>)}</div>; }

function StepIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) { return <section className="editor-intro"><p className="eyebrow"><span />{eyebrow}</p><h1>{title}</h1><p>{lead}</p></section>; }

function InfoCard({ language }: { language: Language }) { return <aside className="next-card"><div className="orbit-icon"><span>?</span></div><h2>{tr(language, "O que acontece agora?", "What happens next?")}</h2><ol><li><span>1</span>{tr(language, "Pesquisamos fontes atuais para as afirmações verificáveis.", "We research current sources for verifiable claims.")}</li><li><span>2</span>{tr(language, "Você abre as fontes e escolhe uma afirmação.", "You open the sources and choose one claim.")}</li><li><span>3</span>{tr(language, "Você decide o que deve mudar.", "You decide what should change.")}</li></ol><div className="small-note"><span>i</span>{tr(language, "Nenhuma fonte será inventada. Se a pesquisa falhar, o site informará claramente.", "No source will be invented. If research fails, the site will say so clearly.")}</div></aside>; }

function ResearchBanner({ analysis, language, onListen, narratorState, stop }: { analysis: AnalysisResult; language: Language; onListen: () => void; narratorState: NarratorState; stop: () => void }) { const active = narratorState === "speaking" || narratorState === "paused"; return <section className={`research-banner ${analysis.mode}`}><div><span>{analysis.mode === "live" ? "●" : "◆"}</span><div><strong>{analysis.mode === "live" ? tr(language, "PESQUISA AO VIVO CONCLUÍDA", "LIVE RESEARCH COMPLETED") : tr(language, "DEMONSTRAÇÃO GUIADA", "GUIDED DEMONSTRATION")}</strong><p>{analysis.researchSummary}</p><small>{analysis.mode === "live" ? tr(language, `${analysis.sources.length} fontes verificáveis encontradas`, `${analysis.sources.length} verifiable sources found`) : tr(language, "Conteúdo educativo preparado · sem pesquisa ao vivo", "Prepared learning content · no live research")}</small></div></div><button disabled={narratorState === "loading"} onClick={active ? stop : onListen}>{active ? `■ ${tr(language, "Parar", "Stop")}` : narratorState === "loading" ? tr(language, "Preparando voz…", "Preparing voice…") : `🔊 ${tr(language, "Ouvir resumo", "Listen to summary")}`}</button></section>; }

function NarrationStatus({ state, language, voiceName, compact = false }: { state: NarratorState; language: Language; voiceName: string | null; compact?: boolean }) { if (state !== "unsupported" && state !== "unavailable" && state !== "error") return null; const message = state === "unsupported" ? tr(language, "A narração não é compatível com este navegador.", "Narration is not supported by this browser.") : state === "unavailable" ? tr(language, "Este dispositivo não possui uma voz instalada para o idioma selecionado.", "This device does not have an installed voice for the selected language.") : tr(language, "A narração foi interrompida. Tente novamente ou use outro navegador.", "Narration was interrupted. Try again or use another browser."); return <p className={`narration-status ${compact ? "compact" : ""}`} role="status" aria-live="polite" title={voiceName ?? undefined}>{message}</p>; }

function SourceDetails({ source, language }: { source: ResearchSource; language: Language }) { return <article className="source-details"><div><span>{tr(language, "FONTE SELECIONADA", "SELECTED SOURCE")}</span><a href={source.url} target="_blank" rel="noreferrer">{tr(language, "Abrir página original ↗", "Open original page ↗")}</a></div><h3>{source.title}</h3><p className="source-byline">{source.publisher} · {source.publishedAt || tr(language, "Data não informada", "Date not provided")}</p><dl><div><dt>{tr(language, "O que a fonte informa", "What the source reports")}</dt><dd>{source.excerpt}</dd></div><div><dt>{tr(language, "Por que ela é relevante", "Why it is relevant")}</dt><dd>{source.relevance}</dd></div></dl></article>; }

function Actions({ back, children, language }: { back: () => void; children: React.ReactNode; language: Language }) { return <div className="editor-actions"><button className="text-button" onClick={back}>← {tr(language, "Voltar", "Back")}</button>{children}</div>; }
