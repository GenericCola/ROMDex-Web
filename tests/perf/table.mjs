// node table.mjs <labelA> [labelB]: markdown table of per-scenario means (A, or A → B).
import { readFileSync, existsSync } from "node:fs";
const dir = process.env.PERF_OUT ?? import.meta.dirname + "/results";
const load = (l) => (l ? [1, 2, 3].map((i) => dir + "/result-" + l + "-r" + i + ".json").filter(existsSync).map((f) => JSON.parse(readFileSync(f))) : []);
const [a, b] = [load(process.argv[2]), load(process.argv[3])];
const avg = (runs, s, k) => { const v = runs.map((r) => r.scenarios[s]?.[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((p, c) => p + c, 0) / v.length) : "–"; };
const cols = [["wallMs", "Wall ms"], ["longTotalMs", "Long total ms"], ["longMaxMs", "Worst long ms"], ["maxEventMs", "Worst input ms"], ["scriptMs", "Script ms"], ["styleMs", "Style ms"], ["layoutMs", "Layout ms"], ["taskMs", "Task ms"], ["domNodes", "DOM nodes"], ["framesOver50", "Frames >50ms"], ["worstFrameMs", "Worst frame ms"]];
console.log("| Scenario | " + cols.map((c) => c[1]).join(" | ") + " |\n|---|" + cols.map(() => "---").join("|") + "|");
for (const s of Object.keys(a[0].scenarios))
  console.log(`| ${s} | ` + cols.map(([k]) => (b.length ? `${avg(a, s, k)} → ${avg(b, s, k)}` : avg(a, s, k))).join(" | ") + " |");
