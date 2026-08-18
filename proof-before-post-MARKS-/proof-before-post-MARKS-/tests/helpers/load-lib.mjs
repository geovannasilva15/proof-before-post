import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cacheDir = join(tmpdir(), "pbp-lib-test-cache");

export async function loadTsModule(relativePath) {
  const sourcePath = join(projectRoot, relativePath);
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      esModuleInterop: true,
    },
    fileName: relativePath,
  }).outputText;
  const hash = createHash("sha1").update(output).digest("hex").slice(0, 16);
  const outputPath = join(cacheDir, `${hash}.mjs`);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(outputPath, output);
  return import(pathToFileURL(outputPath).href);
}
