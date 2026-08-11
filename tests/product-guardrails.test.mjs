import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("keeps the receipt disclaimer in both languages", () => {
  assert.match(source, /This receipt does not certify that the content is true\./);
  assert.match(source, /Este recibo não certifica que o conteúdo é verdadeiro\./);
});

test("limits drafts to 1,500 characters", () => {
  assert.match(source, /maxLength=\{1500\}/);
});

test("offers Portuguese and English", () => {
  assert.match(source, /type Language = "en" \| "pt"/);
});

test("keeps the editorial decision with the creator", () => {
  assert.match(source, /You remain responsible for the final editorial decision\./);
  assert.match(source, /Você continua responsável pela decisão editorial final\./);
});
