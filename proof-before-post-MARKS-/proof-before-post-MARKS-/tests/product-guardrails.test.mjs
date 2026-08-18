import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
const textUtilities = await readFile(new URL("../lib/text.ts", import.meta.url), "utf8");
const narrator = await readFile(new URL("../hooks/useNarrator.ts", import.meta.url), "utf8");

test("keeps the receipt disclaimer in both languages", () => {
  assert.match(source, /This receipt does not certify that the content is true\./);
  assert.match(source, /Este recibo não certifica que o conteúdo é verdadeiro\./);
});

test("limits drafts to 1,500 characters", () => {
  assert.match(source, /MAX_CHARACTERS = 1500/);
  assert.match(source, /limitCharacters\(value, MAX_CHARACTERS, language\)/);
  assert.match(textUtilities, /Intl\.Segmenter/);
});

test("offers Portuguese and English", () => {
  assert.match(source, /document\.documentElement\.lang/);
  assert.match(source, /Pesquisar e encontrar afirmações/);
  assert.match(source, /Research and find claims/);
  assert.match(source, /Abrir fonte original/);
  assert.match(source, /Open original source/);
});

test("keeps the editorial decision with the creator", () => {
  assert.match(source, /You remain responsible for the final editorial decision\./);
  assert.match(source, /Você continua responsável pela decisão editorial final\./);
});

test("uses live web research and verifies returned source URLs", () => {
  assert.match(route, /tools: \[\{ type: "web_search" \}\]/);
  assert.match(route, /tool_choice: "required"/);
  assert.match(route, /store: false/);
  assert.match(route, /web_search_call\.action\.sources/);
  assert.match(route, /collectVerifiedSources/);
  assert.match(route, /verified\.get\(normalized\)/);
  assert.match(route, /matchClaimInDraft/);
  assert.doesNotMatch(source, /customClaims/);
});

test("does not silently substitute a simulated answer", () => {
  assert.match(source, /Nenhuma resposta simulada foi exibida/);
  assert.match(source, /No simulated answer was displayed/);
  assert.match(source, /DEMONSTRAÇÃO GUIADA/);
  assert.match(source, /GUIDED DEMONSTRATION/);
});

test("configures narration for both languages and handles voice loading", () => {
  assert.match(narrator, /pt-BR/);
  assert.match(narrator, /en-US/);
  assert.match(narrator, /voiceschanged/);
  assert.match(narrator, /utterance\.onerror/);
  assert.match(narrator, /unavailable/);
});

test("keeps number formatting and language changes localized", () => {
  assert.match(source, /formatNumber\(language, characterCount\)/);
  assert.match(source, /formatNumber\(language, MAX_CHARACTERS\)/);
  assert.match(source, /A interface foi traduzida/);
  assert.match(source, /The interface was translated/);
});
