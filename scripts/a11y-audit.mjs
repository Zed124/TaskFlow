// Accessibility audit of every page with axe-core (WCAG 2.x A/AA), run inside the real app.
// 1. powershell -File scripts/dev-inspect.ps1      2. node scripts/a11y-audit.mjs [port]
// Prints violations per page; exits non-zero if any serious/critical violation is found.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const port = process.argv[2] ?? "9333";
const axeSource = readFileSync(
  fileURLToPath(new URL("../node_modules/axe-core/axe.min.js", import.meta.url)),
  "utf8",
);
const ROUTES = [
  "#/",
  "#/tasks",
  "#/today",
  "#/upcoming",
  "#/overdue",
  "#/in-progress",
  "#/completed",
  "#/calendar",
  "#/board",
  "#/timeline",
  "#/projects",
  "#/categories",
  "#/analytics",
  "#/activity",
  "#/settings",
];

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const evaluate = (expression, timeoutMs = 20_000) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(
      () => reject(new Error(`timed out: ${expression.slice(0, 60)}`)),
      timeoutMs,
    );
    pending.set(n, (msg) => {
      clearTimeout(timer);
      const r = msg.result;
      if (msg.error || r.exceptionDetails)
        reject(new Error(msg.error?.message ?? r.exceptionDetails.exception?.description));
      else resolve(r.result.value);
    });
    ws.send(
      JSON.stringify({
        id: n,
        method: "Runtime.evaluate",
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await evaluate(`${axeSource}; "axe loaded"`);
let serious = 0;
for (const route of ROUTES) {
  await evaluate(`location.hash = ${JSON.stringify(route)}`);
  await sleep(1200);
  const result =
    await evaluate(`axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })
    .then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      sample: v.nodes.slice(0, 2).map(n => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\\n").slice(1, 2).join("")) })))`);
  const bad = result.filter((v) => v.impact === "serious" || v.impact === "critical");
  serious += bad.length;
  console.log(
    `\n${route}  ${result.length === 0 ? "✓ no violations" : `${result.length} violation type(s)`}`,
  );
  for (const v of result)
    console.log(
      `  [${v.impact}] ${v.id} (${v.nodes}) — ${v.help}\n      ${v.sample.join("\n      ")}`,
    );
}
ws.close();
process.exit(serious > 0 ? 1 : 0);
