"use client";

import { useMemo, useState } from "react";

type Language = "en" | "pt";
type Claim = { text: string; category: string; reason: string; question: string; tone: string };

const demoDraft =
  "UNESCO proved that most digital creators spread misinformation because 62% never verify facts. This means creators are less reliable than journalists.";

const demoRevision =
  "In a UNESCO survey involving 500 digital content creators from 45 countries, 62% reported that they did not conduct rigorous and systematic fact-checking before sharing content. The result highlights a need for training, but it does not prove that creators intentionally spread misinformation or that they are less reliable than journalists.";

const demoClaims: Record<Language, Claim[]> = {
  en: [
    { text: "UNESCO proved that most digital creators spread misinformation.", category: "Unsupported conclusion", reason: "The survey measured verification practices—not how much misinformation creators spread.", question: "What exactly did the UNESCO survey measure?", tone: "amber" },
    { text: "62% never verify facts.", category: "Misrepresented statistic", reason: "The source says 62% did not conduct rigorous, systematic fact-checking. It does not say they never check facts.", question: "Does the word “never” match the source’s wording?", tone: "violet" },
    { text: "Creators are less reliable than journalists.", category: "Unsupported comparison", reason: "The survey did not compare creators with journalists or measure either group’s reliability.", question: "Which evidence supports this comparison?", tone: "teal" },
  ],
  pt: [
    { text: "A UNESCO provou que a maioria dos criadores digitais espalha desinformação.", category: "Conclusão sem apoio", reason: "A pesquisa mediu práticas de verificação — não a quantidade de desinformação divulgada.", question: "O que a pesquisa da UNESCO realmente mediu?", tone: "amber" },
    { text: "62% nunca verificam fatos.", category: "Estatística distorcida", reason: "A fonte afirma que 62% não faziam verificação rigorosa e sistemática. Ela não diz que nunca verificavam nada.", question: "A palavra “nunca” corresponde ao texto da fonte?", tone: "violet" },
    { text: "Criadores são menos confiáveis que jornalistas.", category: "Comparação sem apoio", reason: "A pesquisa não comparou criadores e jornalistas nem mediu a confiabilidade dos grupos.", question: "Qual evidência sustenta essa comparação?", tone: "teal" },
  ],
};

const ui = {
  en: {
    navHow: "How it works", navWhy: "Why it matters", privacy: "Private by design", eyebrow: "Media & Information Literacy",
    titleA: "Pause.", titleB: "Check the evidence.", titleC: "Then post.",
    subtitle: "A guided practice that helps young creators strengthen the evidence behind their content—without letting AI decide the truth for them.",
    demo: "Try the guided example", own: "Review my own draft", noAccount: "No account required", temporary: "Drafts stay in this session", verdict: "No AI truth verdicts",
    stat: "of creators surveyed by UNESCO did not conduct rigorous, systematic fact-checking before sharing content.", source: "UNESCO survey · 500 creators · 45 countries",
    flowTitle: "A decision you can still change", flowText: "Proof Before Post intervenes before content reaches an audience.", step1: "Spot the claim", step2: "Examine the evidence", step3: "Make your decision",
  },
  pt: {
    navHow: "Como funciona", navWhy: "Por que importa", privacy: "Privacidade desde o início", eyebrow: "Educação Midiática e Informacional",
    titleA: "Pare.", titleB: "Confira as evidências.", titleC: "Depois publique.",
    subtitle: "Uma prática guiada que ajuda jovens criadores a fortalecer as evidências de seus conteúdos — sem deixar a IA decidir a verdade por eles.",
    demo: "Testar o exemplo guiado", own: "Revisar meu rascunho", noAccount: "Sem necessidade de cadastro", temporary: "Rascunhos ficam nesta sessão", verdict: "Sem veredito de verdade pela IA",
    stat: "dos criadores pesquisados pela UNESCO não realizavam uma verificação rigorosa e sistemática antes de compartilhar conteúdo.", source: "Pesquisa UNESCO · 500 criadores · 45 países",
    flowTitle: "Uma decisão que ainda pode mudar", flowText: "Proof Before Post intervém antes que o conteúdo chegue ao público.", step1: "Encontre a afirmação", step2: "Examine a evidência", step3: "Tome sua decisão",
  },
} as const;

const supportOptions = {
  en: ["Supports", "Partially supports", "Does not support", "Not enough information"],
  pt: ["Sustenta", "Sustenta parcialmente", "Não sustenta", "Informações insuficientes"],
};

const actionOptions = {
  en: [
    ["Correct the claim", "Narrow or correct what the content asserts.", "✎"],
    ["Add context", "Explain what the source measured—and what it did not.", "+"],
    ["Remove the claim", "Take out a conclusion the evidence cannot support.", "−"],
    ["Keep with transparency", "Keep it while stating the evidence limitation.", "◌"],
    ["Find better evidence", "Pause publication and look for stronger support.", "⌕"],
  ],
  pt: [
    ["Corrigir a afirmação", "Reduza ou corrija o que o conteúdo afirma.", "✎"],
    ["Adicionar contexto", "Explique o que a fonte mediu — e o que não mediu.", "+"],
    ["Remover a afirmação", "Retire uma conclusão que a evidência não sustenta.", "−"],
    ["Manter com transparência", "Mantenha informando a limitação da evidência.", "◌"],
    ["Buscar evidência melhor", "Pause a publicação e procure um apoio mais forte.", "⌕"],
  ],
};

function customClaims(draft: string, language: Language): Claim[] {
  const sentences = draft.split(/(?<=[.!?])\s+/).filter((item) => item.trim()).slice(0, 3);
  return sentences.map((text, index) => ({
    text,
    category: language === "pt" ? ["Afirmação verificável", "Conclusão forte", "Contexto necessário"][index] : ["Verifiable claim", "Strong conclusion", "Context needed"][index],
    reason: language === "pt" ? "Este trecho apresenta algo que o público pode interpretar como fato e merece uma fonte clara." : "This passage presents something audiences may interpret as fact and deserves a clear source.",
    question: language === "pt" ? "Que evidência sustenta exatamente este trecho?" : "What evidence supports this exact passage?",
    tone: ["amber", "violet", "teal"][index],
  }));
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [step, setStep] = useState(0);
  const [guided, setGuided] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedClaim, setSelectedClaim] = useState(0);
  const [support, setSupport] = useState("");
  const [action, setAction] = useState("");
  const [revised, setRevised] = useState("");
  const [reflection, setReflection] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourcePublisher, setSourcePublisher] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const t = ui[language];
  const claims = useMemo(() => guided ? demoClaims[language] : customClaims(draft, language), [guided, draft, language]);
  const claim = claims[selectedClaim] ?? claims[0];

  const labels = language === "pt"
    ? ["Rascunho", "Afirmação", "Evidência", "Decisão", "Recibo"]
    : ["Draft", "Claim", "Evidence", "Decision", "Receipt"];

  function start(isGuided: boolean) {
    setGuided(isGuided); setDraft(isGuided ? demoDraft : ""); setStep(1); setSelectedClaim(0); setSupport(""); setAction(""); setRevised(""); setReflection(""); setCopied(false);
    if (isGuided) { setSourceTitle("UNESCO Digital Content Creators Survey"); setSourcePublisher("UNESCO"); setSourceDate("2024"); setSourceNotes("Survey of 500 digital content creators in 45 countries about verification practices."); }
    else { setSourceTitle(""); setSourcePublisher(""); setSourceDate(""); setSourceNotes(""); }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = language === "pt" ? "pt-BR" : "en-US"; window.speechSynthesis.speak(utterance);
  }

  const receiptSummary = `${language === "pt" ? "Afirmação examinada" : "Claim examined"}: ${claim?.text}\n${language === "pt" ? "Fonte" : "Source"}: ${sourcePublisher || "—"} — ${sourceTitle || "—"}\n${language === "pt" ? "Relação" : "Relationship"}: ${support}\n${language === "pt" ? "Decisão" : "Decision"}: ${action}\n${language === "pt" ? "Reflexão" : "Reflection"}: ${reflection}`;

  async function copyReceipt() {
    await navigator.clipboard.writeText(receiptSummary); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadReceipt() {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1350;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#f7f9ff"; ctx.fillRect(0, 0, 1200, 1350); ctx.fillStyle = "#5c57e7"; ctx.fillRect(0, 0, 1200, 18);
    ctx.fillStyle = "#101e3b"; ctx.font = "700 58px Arial"; ctx.fillText("Evidence Receipt", 80, 115);
    ctx.font = "24px Arial"; ctx.fillStyle = "#667085"; ctx.fillText(language === "pt" ? "Registro das decisões de verificação antes da publicação" : "A record of verification decisions made before publication", 80, 160);
    const sections = [[language === "pt" ? "AFIRMAÇÃO EXAMINADA" : "CLAIM EXAMINED", claim?.text], [language === "pt" ? "FONTE CONSULTADA" : "SOURCE CONSULTED", `${sourcePublisher || "—"} · ${sourceTitle || "—"} · ${sourceDate || "—"}`], [language === "pt" ? "RELAÇÃO COM A EVIDÊNCIA" : "EVIDENCE RELATIONSHIP", support], [language === "pt" ? "DECISÃO EDITORIAL" : "EDITORIAL DECISION", action], [language === "pt" ? "REFLEXÃO" : "REFLECTION", reflection || "—"]];
    let y = 245;
    for (const [title, body] of sections) { ctx.font = "700 18px Arial"; ctx.fillStyle = "#5c57e7"; ctx.fillText(title || "", 80, y); y += 38; ctx.font = "28px Arial"; ctx.fillStyle = "#26324b"; y = wrapCanvasText(ctx, body || "—", 80, y, 1020, 40) + 54; }
    ctx.fillStyle = "#101e3b"; ctx.fillRect(70, 1160, 1060, 125); ctx.fillStyle = "#ffffff"; ctx.font = "700 22px Arial"; ctx.fillText(language === "pt" ? "Este recibo não certifica que o conteúdo é verdadeiro." : "This receipt does not certify that the content is true.", 105, 1215); ctx.font = "19px Arial"; ctx.fillStyle = "#cbd5e7"; ctx.fillText(language === "pt" ? "Ele documenta o processo de verificação do criador." : "It documents the creator’s verification process.", 105, 1252);
    canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "evidence-receipt.png"; link.click(); URL.revokeObjectURL(url); }, "image/png");
  }

  function nextFromDecision() { setRevised(guided ? draft : draft); setStep(5); }

  if (step === 0) return <Landing language={language} setLanguage={setLanguage} start={start} />;

  return (
    <main className="app-shell editor-page">
      <Header language={language} setLanguage={setLanguage} home={() => setStep(0)} compact />
      <Progress step={step} labels={labels} />

      {step === 1 && <>
        <StepIntro eyebrow={language === "pt" ? "ETAPA 1 DE 5" : "STEP 1 OF 5"} title={language === "pt" ? "Revise antes de publicar" : "Review before you publish"} lead={language === "pt" ? "Cole uma legenda, roteiro ou publicação. Vamos encontrar até três afirmações que merecem atenção." : "Paste a caption, script or post. We’ll find up to three claims worth examining."} />
        <section className="editor-grid">
          <div className="draft-card"><label htmlFor="draft">{language === "pt" ? "SEU RASCUNHO" : "YOUR DRAFT"}</label><textarea id="draft" aria-label={language === "pt" ? "SEU RASCUNHO" : "YOUR DRAFT"} value={draft} maxLength={1500} placeholder={language === "pt" ? "Cole seu rascunho aqui…" : "Paste your draft here…"} onChange={(e) => { setDraft(e.target.value); setGuided(false); }} autoFocus /><div className="draft-meta"><span>{language === "pt" ? "Máximo de 1.500 caracteres" : "Maximum 1,500 characters"}</span><strong>{draft.length} / 1,500</strong></div></div>
          <InfoCard language={language} />
        </section>
        <Actions back={() => setStep(0)} language={language}><button className="text-button example-link" onClick={() => start(true)}>{language === "pt" ? "Usar exemplo guiado" : "Use guided example"}</button><button className="primary-button" disabled={!draft.trim()} onClick={() => setStep(2)}>{language === "pt" ? "Encontrar afirmações" : "Find claims to examine"}<span>→</span></button></Actions>
      </>}

      {step === 2 && <>
        <StepIntro eyebrow={language === "pt" ? "ETAPA 2 DE 5" : "STEP 2 OF 5"} title={language === "pt" ? "Qual afirmação merece mais atenção?" : "Which claim deserves the most attention?"} lead={language === "pt" ? "Escolha uma afirmação para investigar. A decisão sobre a prioridade continua sendo sua." : "Choose one claim to investigate. The decision about priority remains yours."} />
        <section className="claims-grid">{claims.map((item, index) => <article role="button" tabIndex={0} key={index} className={`claim-card ${item.tone} ${selectedClaim === index ? "selected" : ""}`} onClick={() => setSelectedClaim(index)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedClaim(index); }}><div className="claim-head"><span>{String(index + 1).padStart(2, "0")}</span><b>{item.category}</b><i>{selectedClaim === index ? "✓" : ""}</i></div><blockquote>“{item.text}”</blockquote><div className="claim-reason"><small>{language === "pt" ? "POR QUE MERECE ATENÇÃO" : "WHY IT NEEDS ATTENTION"}</small><p>{item.reason}</p></div><div className="claim-question"><span>?</span><p>{item.question}</p><button aria-label={language === "pt" ? "Ouvir pergunta" : "Listen to question"} onClick={(e) => { e.stopPropagation(); speak(item.question); }}>◖))</button></div></article>)}</section>
        <Actions back={() => setStep(1)} language={language}><button className="primary-button" onClick={() => setStep(3)}>{language === "pt" ? "Examinar esta afirmação" : "Examine this claim"}<span>→</span></button></Actions>
      </>}

      {step === 3 && <>
        <StepIntro eyebrow={language === "pt" ? "ETAPA 3 DE 5" : "STEP 3 OF 5"} title={language === "pt" ? "O que a evidência realmente sustenta?" : "What does the evidence really support?"} lead={language === "pt" ? "Examine a origem, o que foi medido e o contexto antes de escolher uma resposta." : "Examine the origin, what was measured and the context before choosing a response."} />
        <section className="evidence-grid">
          <div className="evidence-panel"><span className="panel-label">{language === "pt" ? "AFIRMAÇÃO ESCOLHIDA" : "SELECTED CLAIM"}</span><blockquote>“{claim?.text}”</blockquote><div className="source-form"><label>{language === "pt" ? "Fonte ou título" : "Source or title"}<input value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder={language === "pt" ? "Título da fonte" : "Source title"} /></label><div><label>{language === "pt" ? "Autor ou instituição" : "Author or institution"}<input value={sourcePublisher} onChange={(e) => setSourcePublisher(e.target.value)} placeholder="UNESCO" /></label><label>{language === "pt" ? "Data" : "Date"}<input value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} placeholder="2024" /></label></div><label>{language === "pt" ? "O que a fonte mediu ou informou?" : "What did the source measure or report?"}<textarea value={sourceNotes} onChange={(e) => setSourceNotes(e.target.value)} placeholder={language === "pt" ? "Registre os detalhes importantes…" : "Record the important details…"} /></label></div></div>
          <aside className="support-panel"><span className="panel-label">{language === "pt" ? "SUA AVALIAÇÃO" : "YOUR ASSESSMENT"}</span><h2>{language === "pt" ? "A fonte sustenta a afirmação completa?" : "Does the source support the complete claim?"}</h2><div className="support-options">{supportOptions[language].map((item) => <button key={item} className={support === item ? "selected" : ""} onClick={() => setSupport(item)}><i>{support === item ? "✓" : ""}</i>{item}</button>)}</div><button className="listen-link" onClick={() => speak(claim?.question || "")}>◖)) {language === "pt" ? "Ouvir pergunta educativa" : "Listen to the guiding question"}</button><div className="human-note">{language === "pt" ? "A plataforma explica as opções, mas não escolhe por você." : "The platform explains the options, but does not choose for you."}</div></aside>
        </section>
        <Actions back={() => setStep(2)} language={language}><button className="primary-button" disabled={!support} onClick={() => setStep(4)}>{language === "pt" ? "Continuar para a decisão" : "Continue to decision"}<span>→</span></button></Actions>
      </>}

      {step === 4 && <>
        <StepIntro eyebrow={language === "pt" ? "ETAPA 4 DE 5" : "STEP 4 OF 5"} title={language === "pt" ? "O que você fará antes de publicar?" : "What will you do before publishing?"} lead={language === "pt" ? "Você continua responsável pela decisão editorial final." : "You remain responsible for the final editorial decision."} />
        <section className="decision-grid">{actionOptions[language].map(([title, desc, icon]) => <button key={title} className={action === title ? "selected" : ""} onClick={() => setAction(title)}><span>{icon}</span><div><h3>{title}</h3><p>{desc}</p></div><i>{action === title ? "✓" : "→"}</i></button>)}</section>
        <div className="responsibility-note"><span>!</span><p><strong>{language === "pt" ? "A decisão é sua." : "The decision is yours."}</strong> {language === "pt" ? "Proof Before Post orienta seu raciocínio; não aprova a publicação." : "Proof Before Post guides your reasoning; it does not approve publication."}</p></div>
        <Actions back={() => setStep(3)} language={language}><button className="primary-button" disabled={!action} onClick={nextFromDecision}>{language === "pt" ? "Revisar o conteúdo" : "Revise the content"}<span>→</span></button></Actions>
      </>}

      {step === 5 && <>
        <StepIntro eyebrow={language === "pt" ? "REVISÃO FINAL" : "FINAL REVISION"} title={language === "pt" ? "Torne a mudança visível" : "Make the change visible"} lead={language === "pt" ? "Edite com suas próprias palavras e registre o que mudou na sua conclusão." : "Edit in your own words and record what changed in your conclusion."} />
        <section className="revision-grid"><div className="version-card original"><span>{language === "pt" ? "RASCUNHO ORIGINAL" : "ORIGINAL DRAFT"}</span><p>{draft}</p></div><div className="version-card revised"><div className="version-label"><span>{language === "pt" ? "VERSÃO REVISADA" : "REVISED DRAFT"}</span>{guided && <button onClick={() => setRevised(demoRevision)}>{language === "pt" ? "Usar revisão demonstrativa" : "Use transparent demo revision"}</button>}</div><textarea value={revised} onChange={(e) => setRevised(e.target.value)} aria-label={language === "pt" ? "VERSÃO REVISADA" : "REVISED DRAFT"} /></div></section>
        <section className="reflection-card"><label>{language === "pt" ? "O que mudou na sua conclusão?" : "What changed in your conclusion?"}</label><div>{(language === "pt" ? ["Reduzi a afirmação", "Adicionei contexto", "Reconheci a incerteza", "Removi uma conclusão sem apoio"] : ["I narrowed the claim", "I added missing context", "I acknowledged uncertainty", "I removed an unsupported conclusion"]).map((item) => <button key={item} className={reflection === item ? "selected" : ""} onClick={() => setReflection(item)}>{reflection === item ? "✓ " : ""}{item}</button>)}</div></section>
        <Actions back={() => setStep(4)} language={language}><button className="primary-button" disabled={!revised.trim() || !reflection} onClick={() => setStep(6)}>{language === "pt" ? "Criar meu Evidence Receipt" : "Create my Evidence Receipt"}<span>→</span></button></Actions>
      </>}

      {step === 6 && <>
        <StepIntro eyebrow={language === "pt" ? "ETAPA 5 DE 5" : "STEP 5 OF 5"} title={language === "pt" ? "Seu processo, documentado" : "Your process, documented"} lead={language === "pt" ? "Um registro transparente das decisões tomadas antes da publicação." : "A transparent record of the decisions made before publication."} />
        <section className="receipt-wrap"><article className="receipt-card" id="receipt"><div className="receipt-header"><div><span className="brand-mark"><span /></span><div><h2>Evidence Receipt</h2><p>{language === "pt" ? "Registro de verificação pré-publicação" : "Pre-publication verification record"}</p></div></div><time>{new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US").format(new Date())}</time></div><div className="receipt-section"><span>{language === "pt" ? "AFIRMAÇÃO EXAMINADA" : "CLAIM EXAMINED"}</span><blockquote>“{claim?.text}”</blockquote></div><div className="receipt-two"><div><span>{language === "pt" ? "FONTE CONSULTADA" : "SOURCE CONSULTED"}</span><strong>{sourcePublisher || "—"}</strong><p>{sourceTitle || "—"} · {sourceDate || "—"}</p></div><div><span>{language === "pt" ? "RELAÇÃO" : "RELATIONSHIP"}</span><strong>{support}</strong><p>{language === "pt" ? "Avaliação feita pelo criador" : "Assessment made by the creator"}</p></div></div><div className="receipt-two"><div><span>{language === "pt" ? "DECISÃO EDITORIAL" : "EDITORIAL DECISION"}</span><strong>{action}</strong></div><div><span>{language === "pt" ? "APRENDIZADO" : "LEARNING"}</span><strong>{reflection}</strong></div></div><div className="receipt-change"><span>{language === "pt" ? "MUDANÇA REALIZADA" : "CHANGE MADE"}</span><div><p>{draft}</p><i>→</i><p>{revised}</p></div></div><div className="receipt-disclaimer"><span>i</span><p><strong>{language === "pt" ? "Este recibo não certifica que o conteúdo é verdadeiro." : "This receipt does not certify that the content is true."}</strong><br />{language === "pt" ? "Ele documenta o processo de verificação e as decisões do criador." : "It documents the creator’s verification process and decisions."}</p></div></article><aside className="receipt-actions"><h3>{language === "pt" ? "Pronto para compartilhar o processo" : "Ready to share the process"}</h3><p>{language === "pt" ? "Baixe o recibo como imagem ou copie um resumo. O conteúdo continua sendo sua responsabilidade." : "Download the receipt as an image or copy a summary. You remain responsible for the content."}</p><button className="primary-button" onClick={downloadReceipt}>↓ {language === "pt" ? "Baixar como imagem" : "Download as image"}</button><button className="secondary-button" onClick={copyReceipt}>{copied ? (language === "pt" ? "Resumo copiado ✓" : "Summary copied ✓") : (language === "pt" ? "Copiar resumo" : "Copy summary")}</button><button className="text-button" onClick={() => start(false)}>{language === "pt" ? "Revisar outro rascunho" : "Review another draft"}</button></aside></section>
      </>}
    </main>
  );
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) { const words = text.split(" "); let line = ""; for (const word of words) { const test = line + word + " "; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, y); line = word + " "; y += lineHeight; } else line = test; } ctx.fillText(line, x, y); return y; }

function Header({ language, setLanguage, home, compact = false }: { language: Language; setLanguage: (v: Language) => void; home: () => void; compact?: boolean }) { return <header className={`site-header ${compact ? "compact" : ""}`}><button className="brand" onClick={home} aria-label="Proof Before Post home"><span className="brand-mark"><span /></span><span>Proof Before Post</span></button>{!compact && <nav aria-label="Main navigation"><a href="#how">{ui[language].navHow}</a><a href="#why">{ui[language].navWhy}</a></nav>}<div className="header-actions">{!compact && <span className="privacy-pill"><i />{ui[language].privacy}</span>}<div className="language-toggle" aria-label="Language"><button className={language === "pt" ? "active" : ""} onClick={() => setLanguage("pt")}>PT</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button></div></div></header>; }

function Landing({ language, setLanguage, start }: { language: Language; setLanguage: (v: Language) => void; start: (guided: boolean) => void }) { const t = ui[language]; return <main className="app-shell home-page"><Header language={language} setLanguage={setLanguage} home={() => {}} /><section className="hero"><div className="hero-copy"><p className="eyebrow"><span />{t.eyebrow}</p><h1><span>{t.titleA}</span><br />{t.titleB}<br /><em>{t.titleC}</em></h1><p className="hero-subtitle">{t.subtitle}</p><div className="hero-actions"><button className="primary-button" onClick={() => start(true)}>{t.demo}<span>→</span></button><button className="secondary-button" onClick={() => start(false)}>{t.own}</button></div><div className="trust-row"><span>✓ {t.noAccount}</span><span>✓ {t.temporary}</span><span>✓ {t.verdict}</span></div></div><HeroVisual language={language} /></section><section className="proof-strip" id="why"><div className="stat-block"><strong>62<span>%</span></strong><p>{t.stat}</p></div><div className="source-block"><span>↗</span><div><strong>{t.source}</strong><small>{language === "pt" ? "O problema existe. A decisão ainda é humana." : "The problem is real. The decision remains human."}</small></div></div></section><section className="how-section" id="how"><div><p className="eyebrow"><span />{language === "pt" ? "COMO FUNCIONA" : "HOW IT WORKS"}</p><h2>{t.flowTitle}</h2><p>{t.flowText}</p></div><div className="step-row"><article><span>01</span><div className="step-symbol">“ ”</div><h3>{t.step1}</h3></article><article><span>02</span><div className="step-symbol">⌕</div><h3>{t.step2}</h3></article><article><span>03</span><div className="step-symbol">✓</div><h3>{t.step3}</h3></article></div></section></main>; }

function HeroVisual({ language }: { language: Language }) { return <div className="hero-visual" aria-label="Evidence review illustration"><div className="visual-glow" /><div className="evidence-card card-back"><div className="fake-lines"><i /><i /><i /></div></div><div className="evidence-card card-main"><div className="card-top"><span className="doc-icon">▤</span><span>{language === "pt" ? "RASCUNHO" : "DRAFT"}</span><i>•••</i></div><p>“UNESCO proved that <mark>most creators spread misinformation</mark>...”</p><div className="claim-callout"><span>!</span><div><strong>{language === "pt" ? "CONCLUSÃO SEM APOIO" : "UNSUPPORTED CONCLUSION"}</strong><small>{language === "pt" ? "O que a fonte realmente mediu?" : "What did the source actually measure?"}</small></div></div><div className="card-status"><span>01</span><i /><b>{language === "pt" ? "AFIRMAÇÃO ENCONTRADA" : "CLAIM FOUND"}</b></div></div><div className="receipt-mini"><span className="check">✓</span><div><strong>{language === "pt" ? "EVIDÊNCIA EXAMINADA" : "EVIDENCE EXAMINED"}</strong><small>{language === "pt" ? "Contexto adicionado antes de publicar" : "Context added before publishing"}</small></div></div></div>; }

function Progress({ step, labels }: { step: number; labels: string[] }) { const current = step === 5 ? 4 : Math.min(step, 5); return <div className="progress-wrap" aria-label="Review progress">{labels.map((label, index) => <div className="progress-fragment" key={label}><div className={`progress-label ${index + 1 <= current ? "done" : "muted"}`}><strong>{index + 1 < current ? "✓" : String(index + 1).padStart(2, "0")}</strong><span>{label}</span></div>{index < labels.length - 1 && <div className={`progress-line ${index + 1 < current ? "filled" : ""}`} />}</div>)}</div>; }

function StepIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) { return <section className="editor-intro"><p className="eyebrow"><span />{eyebrow}</p><h1>{title}</h1><p>{lead}</p></section>; }

function InfoCard({ language }: { language: Language }) { return <aside className="next-card"><div className="orbit-icon"><span>?</span></div><h2>{language === "pt" ? "O que acontece agora?" : "What happens next?"}</h2><ol><li><span>1</span>{language === "pt" ? "Identificamos afirmações que podem precisar de evidências." : "We identify statements that may need evidence."}</li><li><span>2</span>{language === "pt" ? "Você escolhe uma para investigar." : "You choose one to investigate."}</li><li><span>3</span>{language === "pt" ? "Você decide o que deve mudar." : "You decide what should change."}</li></ol><div className="small-note"><span>i</span>{language === "pt" ? "A IA não classificará seu conteúdo como verdadeiro ou falso." : "AI will not classify your content as true or false."}</div></aside>; }

function Actions({ back, children, language }: { back: () => void; children: React.ReactNode; language: Language }) { return <div className="editor-actions"><button className="text-button" onClick={back}>← {language === "pt" ? "Voltar" : "Back"}</button>{children}</div>; }
