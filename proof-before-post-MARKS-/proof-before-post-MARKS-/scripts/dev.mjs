import { spawn } from "node:child_process";
import { join } from "node:path";

const incoming = process.argv.slice(2);
const forwarded = [];

for (let index = 0; index < incoming.length; index += 1) {
  const argument = incoming[index];
  if (argument === "--strictPort") continue;
  if (argument === "--host") {
    forwarded.push("--hostname");
    if (incoming[index + 1] && !incoming[index + 1].startsWith("--")) {
      forwarded.push(incoming[index + 1]);
      index += 1;
    }
    continue;
  }
  forwarded.push(argument);
}

const nextCli = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextCli, "dev", ...forwarded], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
