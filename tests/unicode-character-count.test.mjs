import assert from "node:assert/strict";
import test from "node:test";

function characters(value, locale = "en") {
  return Array.from(new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(value), ({ segment }) => segment);
}

test("counts visible characters instead of UTF-16 code units", () => {
  assert.equal(characters("abc").length, 3);
  assert.equal(characters("👩🏽‍💻").length, 1);
  assert.equal(characters("🇧🇷").length, 1);
  assert.equal(characters("e\u0301").length, 1);
});

test("limits text without splitting a visible character", () => {
  assert.equal(characters("A👩🏽‍💻B").slice(0, 2).join(""), "A👩🏽‍💻");
});
