// `pnpm dev`: the dev API (server/dev-api.ts) on 127.0.0.1 plus `next dev`, which forwards
// /api/* to it. Stopping either one stops both.
import { spawn } from "node:child_process";
const children = [
  ["--experimental-strip-types", "--no-warnings", "server/dev-api.ts"],
  ["scripts/next.mjs", "dev", "--port", "3000", ...process.argv.slice(2)],
].map(function start(args) {
  return spawn(process.execPath, args, { stdio: "inherit" });
});
let code = 0;
function stopAll() {
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
}
for (const child of children)
  child.on("exit", function stopped(status) {
    code ||= status ?? 0;
    stopAll();
    if (children.every((each) => each.exitCode !== null || each.signalCode))
      process.exit(code);
  });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, stopAll);
