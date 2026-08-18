import assert from "node:assert/strict";
import test from "node:test";
import { loadTsModule } from "./helpers/load-lib.mjs";

const text = await loadTsModule("lib/text.ts");
const { countCharacters, limitCharacters } = text;

test("counts visible characters instead of UTF-16 code units", () => {
  assert.equal(countCharacters("abc", "en"), 3);
  assert.equal(countCharacters("👩🏽‍💻", "en"), 1);
  assert.equal(countCharacters("🇧🇷", "en"), 1);
  assert.equal(countCharacters("e\u0301", "en"), 1);
});

test("limits text without splitting a visible character", () => {
  assert.equal(limitCharacters("A👩🏽‍💻B", 2, "en"), "A👩🏽‍💻");
});
