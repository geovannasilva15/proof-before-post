import type { Language, ResearchSource } from "./analysis";
import { translate, type TranslationKey } from "./i18n";

export type ReceiptData = {
  language: Language;
  claim: string;
  source: ResearchSource;
  support: string;
  justification: string;
  decision: string;
  originalDraft: string;
  revisedDraft: string;
  reflection: string;
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

export function buildReceiptSummary(data: ReceiptData) {
  const l = receiptLabels(data.language);
  const date = new Intl.DateTimeFormat(locale(data.language), { dateStyle: "medium", timeStyle: "short" }).format(data.createdAt);
  return [
    l.title,
    l.subtitle,
    "",
    `${l.claim}: ${data.claim}`,
    `${l.source}: ${data.source.title}`,
    `${l.author}: ${data.source.authorOrInstitution}`,
    `${l.date}: ${data.source.publishedAt || "—"}`,
    `${l.type}: ${data.source.sourceType || "—"}`,
    `${l.url}: ${data.source.url}`,
    `${l.accessed}: ${data.source.accessedAt}`,
    `${l.measured}: ${data.source.measuredOrReported}`,
    `${l.limitation}: ${data.source.doesNotEstablish}`,
    `${l.support}: ${data.support}`,
    `${l.justification}: ${data.justification}`,
    `${l.decision}: ${data.decision}`,
    `${l.original}: ${data.originalDraft}`,
    `${l.revised}: ${data.revisedDraft}`,
    `${l.reflection}: ${data.reflection}`,
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
