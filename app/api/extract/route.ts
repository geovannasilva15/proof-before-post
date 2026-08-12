import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../lib/rate-limit";
import { countCharacters, limitCharacters } from "../../../lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESPONSE_BYTES = 300_000;
const MAX_EXTRACTED_CHARACTERS = 5_000;
const MAX_REDIRECTS = 3;

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) {
    const parts = normalized.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
  }
  if (isIP(normalized) === 6) {
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
  }
  return true;
}

async function validatePublicUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("UNSAFE_URL");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("UNSAFE_URL");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("UNSAFE_URL");
  return url;
}

async function fetchPublicPage(initialUrl: URL) {
  let current = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await validatePublicUrl(current.toString());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "ProofBeforePost/1.0 (+https://proof-before-post.vercel.app/)" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) throw new Error("REDIRECT_ERROR");
        current = await validatePublicUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) throw new Error("FETCH_ERROR");
      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) throw new Error("UNSUPPORTED_CONTENT");
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("CONTENT_TOO_LARGE");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error("CONTENT_TOO_LARGE");
      return { body: new TextDecoder("utf-8", { fatal: false }).decode(bytes), url: current.toString(), contentType };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("REDIRECT_ERROR");
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function extractText(html: string, contentType: string) {
  if (contentType.includes("text/plain")) return { title: "", text: html.trim() };
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const mainMatch = html.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
  const scope = mainMatch?.[2] || html;
  const text = decodeEntities(scope
    .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: decodeEntities(titleMatch?.[1]?.trim() || ""), text };
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, "extract", 15, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }
  let value: unknown;
  try {
    value = (await request.json() as { url?: unknown }).url;
  } catch {
    return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  if (typeof value !== "string" || value.length > 2_000) return NextResponse.json({ code: "INVALID_URL" }, { status: 400 });
  try {
    const initialUrl = await validatePublicUrl(value.trim());
    const page = await fetchPublicPage(initialUrl);
    const extracted = extractText(page.body, page.contentType);
    if (countCharacters(extracted.text) < 20) return NextResponse.json({ code: "NO_CONTENT" }, { status: 422 });
    return NextResponse.json({
      title: extracted.title,
      url: page.url,
      text: limitCharacters(extracted.text, MAX_EXTRACTED_CHARACTERS),
      truncated: countCharacters(extracted.text) > MAX_EXTRACTED_CHARACTERS,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : error instanceof Error ? error.message : "FETCH_ERROR";
    const status = code === "UNSAFE_URL" ? 400 : code === "CONTENT_TOO_LARGE" || code === "UNSUPPORTED_CONTENT" ? 422 : code === "TIMEOUT" ? 504 : 502;
    return NextResponse.json({ code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
