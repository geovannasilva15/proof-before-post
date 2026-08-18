import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/text.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const text = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("the production counter counts visible Unicode characters", () => {
  assert.equal(text.countCharacters("abc"), 3);
  assert.equal(text.countCharacters("ação"), 4);
  assert.equal(text.countCharacters("👩🏽‍💻"), 1);
  assert.equal(text.countCharacters("👨‍👩‍👧‍👦"), 1);
  assert.equal(text.countCharacters("🇧🇷"), 1);
  assert.equal(text.countCharacters("e\u0301"), 1);
  assert.equal(text.countCharacters("a\nb"), 3);
});

test("the production limiter never splits a visible character", () => {
  assert.equal(text.limitCharacters("A👩🏽‍💻B", 2), "A👩🏽‍💻");
});
