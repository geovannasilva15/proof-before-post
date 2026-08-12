import type { Language, ResearchSource } from "./analysis";
import { translate, type TranslationKey } from "./i18n";
import type { ComparisonNotes, RevisionCitation, SessionStatus } from "./session";

export type ReceiptData = {
  language: Language;
  claim: string;
  sources?: ResearchSource[];
  /** @deprecated compatibility with receipts created before multi-source support */
  source?: ResearchSource;
  support: string;
  justification: string;
  decision: string;
  originalDraft: string;
  revisedDraft: string;
  reflection: string;
  comparisonNotes?: ComparisonNotes;
  citations?: RevisionCitation[];
  checklist?: string[];
  pending?: boolean;
  status?: SessionStatus;
  translatedDraft?: string;
  createdAt: Date;
};

const receiptKeys = {
  title: "receiptTitle",
  subtitle: "receiptSubtitle",
  claim: "receiptFieldClaim",
  source: "receiptFieldSource",
  author: "receiptFieldAuthor",
  date: "receiptFieldDate",
  type: "receiptFieldType",
  methodology: "receiptFieldMethodology",
  sample: "receiptFieldSample",
  geography: "receiptFieldGeography",
  findings: "receiptFieldFindings",
  url: "receiptFieldUrl",
  accessed: "receiptFieldAccessed",
  measured: "receiptFieldMeasured",
  limitation: "receiptFieldLimitation",
  support: "receiptFieldSupport",
  justification: "receiptFieldJustification",
  decision: "receiptFieldDecision",
  original: "receiptFieldOriginal",
  revised: "receiptFieldRevised",
  reflection: "receiptFieldReflection",
  reviewedAt: "receiptFieldReviewedAt",
  citations: "receiptFieldCitations",
  pending: "receiptFieldPending",
  status: "receiptFieldStatus",
  checklist: "receiptFieldChecklist",
  disclaimer: "receiptDisclaimer",
} as const satisfies Record<string, TranslationKey>;

function receiptLabels(language: Language) {
  return Object.fromEntries(
    Object.entries(receiptKeys).map(([name, key]) => [name, translate(language, key)]),
  ) as Record<keyof typeof receiptKeys, string>;
}

function locale(language: Language) {
  return language === "pt" ? "pt-BR" : "en-US";
}

function statusText(language: Language, status: SessionStatus | undefined) {
  return translate(language, status === "completed" ? "statusCompleted" : status === "completed_with_pending" ? "statusPending" : "statusInProgress");
}

export function localizedStatus(language: Language, status: SessionStatus) {
  return statusText(language, status);
}

function checklistText(language: Language, checklist: string[] | undefined) {
  const keys: Record<string, TranslationKey> = { opened: "checklistOpenedSource", identity: "checklistIdentity", date: "checklistDate", method: "checklistMethod", limitation: "checklistLimitation", scope: "checklistScope", final: "checklistFinalText" };
  return (checklist ?? []).map((item) => keys[item] ? translate(language, keys[item]) : item).join("; ");
}

function comparisonLines(data: ReceiptData) {
  if (!data.comparisonNotes) return [];
  const entries: Array<[TranslationKey, keyof ComparisonNotes]> = [["convergence", "convergence"], ["divergences", "divergences"], ["methodologyDifferences", "methodologyDifferences"], ["scopeDifferences", "scopeDifferences"], ["missingInformation", "missingInformation"]];
  return entries.filter(([, field]) => data.comparisonNotes?.[field].trim()).map(([key, field]) => `${translate(data.language, key)}: ${data.comparisonNotes?.[field]}`);
}

export function buildReceiptSummary(data: ReceiptData) {
  const l = receiptLabels(data.language);
  const sources = data.sources ?? (data.source ? [data.source] : []);
  const citations = data.citations ?? [];
  const date = new Intl.DateTimeFormat(locale(data.language), { dateStyle: "medium", timeStyle: "short" }).format(data.createdAt);
  const sourceLines = sources.flatMap((source, index) => [
    `${l.source} ${index + 1}: ${source.title}`,
    `${l.author}: ${source.authorOrInstitution}`,
    `${l.date}: ${source.publishedAt || "—"}`,
    `${l.type}: ${source.sourceType || "—"}`,
    `${l.methodology}: ${source.methodology || "—"}`,
    `${l.sample}: ${source.sample || "—"}`,
    `${l.geography}: ${source.geography || "—"}`,
    `${l.findings}: ${source.keyFindings || "—"}`,
    `${l.url}: ${source.url}`,
    `${l.accessed}: ${source.accessedAt}`,
    `${l.measured}: ${source.measuredOrReported}`,
    `${l.limitation}: ${source.doesNotEstablish}`,
    "",
  ]);
  const citationLines = citations.length ? citations.map((citation, index) => {
    const source = sources.find((item) => item.id === citation.sourceId);
    const state = citation.broken ? translate(data.language, "citationAssociationBroken") : source?.title || "—";
    return `${index + 1}. “${citation.citedText}” — ${state}${citation.note ? ` (${citation.note})` : ""}`;
  }) : [translate(data.language, "noPassageReferences")];
  const pendingText = translate(data.language, data.pending ? "pendingRecorded" : "noPendingRecorded");
  return [
    l.title,
    l.subtitle,
    "",
    `${l.claim}: ${data.claim}`,
    ...sourceLines,
    `${l.support}: ${data.support}`,
    `${l.justification}: ${data.justification}`,
    `${l.decision}: ${data.decision}`,
    `${l.original}: ${data.originalDraft}`,
    `${l.revised}: ${data.revisedDraft}`,
    `${l.reflection}: ${data.reflection}`,
    ...comparisonLines(data),
    `${l.status}: ${statusText(data.language, data.status)}`,
    `${l.pending}: ${pendingText}`,
    `${l.checklist}: ${checklistText(data.language, data.checklist)}`,
    `${l.citations}:`,
    ...citationLines,
    `${l.reviewedAt}: ${date}`,
    "",
    l.disclaimer,
  ].join("\n");
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maximumWidth: number) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maximumWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function downloadReceiptPng(data: ReceiptData) {
  const l = receiptLabels(data.language);
  const width = 1400;
  const horizontalPadding = 96;
  const maximumWidth = width - horizontalPadding * 2;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("Canvas is unavailable");
  measure.font = "30px Arial, sans-serif";
  const summaryLines = wrapLines(measure, buildReceiptSummary(data), maximumWidth);
  const height = Math.max(1700, 280 + summaryLines.length * 44 + 220);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  ctx.fillStyle = "#f7f9ff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#5c57e7";
  ctx.fillRect(0, 0, width, 20);
  ctx.fillStyle = "#101e3b";
  ctx.font = "700 62px Arial, sans-serif";
  ctx.fillText(l.title, horizontalPadding, 115);
  ctx.fillStyle = "#667085";
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText(l.subtitle, horizontalPadding, 165);

  ctx.font = "30px Arial, sans-serif";
  let y = 245;
  for (const line of summaryLines.slice(3, -2)) {
    if (!line) {
      y += 20;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator > 0 && separator < 45) {
      const label = line.slice(0, separator + 1);
      const value = line.slice(separator + 1).trim();
      ctx.fillStyle = "#5c57e7";
      ctx.font = "700 25px Arial, sans-serif";
      ctx.fillText(label, horizontalPadding, y);
      y += 38;
      ctx.fillStyle = "#26324b";
      ctx.font = "30px Arial, sans-serif";
      for (const valueLine of wrapLines(ctx, value || "—", maximumWidth)) {
        ctx.fillText(valueLine, horizontalPadding, y);
        y += 42;
      }
      y += 24;
    } else {
      ctx.fillStyle = "#26324b";
      ctx.font = "30px Arial, sans-serif";
      ctx.fillText(line, horizontalPadding, y);
      y += 42;
    }
  }

  const boxY = height - 190;
  ctx.fillStyle = "#101e3b";
  ctx.fillRect(72, boxY, width - 144, 130);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 25px Arial, sans-serif";
  const disclaimerLines = wrapLines(ctx, l.disclaimer, width - 240);
  disclaimerLines.forEach((line, index) => ctx.fillText(line, 112, boxY + 50 + index * 34));

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG generation failed")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `proof-before-post-resumo-${new Date().toISOString().slice(0, 10)}.png`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadReceiptPdf(data: ReceiptData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setLanguage(data.language === "pt" ? "pt-BR" : "en-US");
  doc.setProperties({ title: translate(data.language, "receiptTitle"), subject: translate(data.language, "receiptSubtitle"), creator: "Proof Before Post" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 52;
  const contentWidth = width - margin * 2;
  const l = receiptLabels(data.language);
  const sources = data.sources ?? (data.source ? [data.source] : []);
  let y = margin;

  const newPage = () => { doc.addPage(); y = margin; };
  const ensureSpace = (needed: number) => { if (y + needed > height - margin) newPage(); };
  const write = (value: string, options: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) => {
    const size = options.size ?? 10;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? [38, 50, 75]));
    const lines = doc.splitTextToSize(value || "—", contentWidth) as string[];
    const lineHeight = size * 1.45;
    for (const line of lines) { ensureSpace(lineHeight); doc.text(line, margin, y); y += lineHeight; }
  };
  const field = (label: string, value: string) => { ensureSpace(40); write(label.toUpperCase(), { bold: true, size: 8, color: [92, 87, 231] }); write(value); y += 8; };

  write(l.title, { bold: true, size: 23, color: [16, 30, 59] });
  write(l.subtitle, { size: 11, color: [102, 112, 133] });
  y += 16;
  field(l.claim, data.claim);
  sources.forEach((source, index) => {
    field(`${l.source} ${index + 1}`, source.title);
    field(l.author, source.authorOrInstitution);
    field(l.date, source.publishedAt || "—");
    field(l.type, source.sourceType || "—");
    field(l.methodology, source.methodology || "—");
    field(l.sample, source.sample || "—");
    field(l.geography, source.geography || "—");
    field(l.findings, source.keyFindings || "—");
    field(l.measured, source.measuredOrReported);
    field(l.limitation, source.doesNotEstablish);
    ensureSpace(30);
    write(l.url.toUpperCase(), { bold: true, size: 8, color: [92, 87, 231] });
    doc.setTextColor(61, 81, 170); doc.setFontSize(9);
    const urlLines = doc.splitTextToSize(source.url, contentWidth) as string[];
    for (const line of urlLines) { ensureSpace(14); doc.textWithLink(line, margin, y, { url: source.url }); y += 14; }
    y += 10;
  });
  field(l.support, data.support);
  field(l.justification, data.justification);
  field(l.decision, data.decision);
  field(l.original, data.originalDraft);
  field(l.revised, data.revisedDraft);
  if (data.translatedDraft) field(translate(data.language, "receiptTranslatedCopy"), data.translatedDraft);
  field(l.reflection, data.reflection);
  for (const line of comparisonLines(data)) field(translate(data.language, "comparisonTitle"), line);
  field(l.status, statusText(data.language, data.status));
  field(l.pending, translate(data.language, data.pending ? "yes" : "no"));
  field(l.checklist, checklistText(data.language, data.checklist) || "—");
  field(l.citations, (data.citations ?? []).map((citation) => { const source = sources.find((item) => item.id === citation.sourceId); return `“${citation.citedText}” — ${source?.title || "—"}${citation.broken ? ` (${translate(data.language, "citationBroken")})` : ""}`; }).join("; ") || "—");
  field(l.reviewedAt, new Intl.DateTimeFormat(locale(data.language), { dateStyle: "medium", timeStyle: "short" }).format(data.createdAt));
  ensureSpace(70); y += 10;
  write(l.disclaimer, { bold: true, size: 10, color: [16, 30, 59] });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(120, 128, 145);
    doc.text(`${page} / ${pages}`, width - margin, height - 24, { align: "right" });
  }
  doc.save(`proof-before-post-resumo-${new Date().toISOString().slice(0, 10)}.pdf`);
}
