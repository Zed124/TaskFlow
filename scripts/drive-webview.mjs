// Drives the TaskFlow WebView2 page via the Chrome DevTools Protocol, for UI checks during
// development. Input is dispatched *into the webview only* — never as OS-level mouse/keyboard
// events — so it can't reach other windows.
//
// 1. Start the app with the DevTools port:   powershell -File scripts/dev-inspect.ps1
// 2. Run a script of steps:                  node scripts/drive-webview.mjs 9333 steps.json
//
// Usage: node drive-webview.mjs <port> <steps-json-file>
// Commands file: array of steps:
//   {"eval": "js expression"} | {"shot": "path.png"} | {"wait": ms}
//   {"click": "css selector"} | {"type": "text"} | {"key": "Enter", "ctrl": true}
//   {"hash": "#/board"}
import { readFileSync, writeFileSync } from "node:fs";

const [port, file] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(file, "utf8"));
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");
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
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) =>
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result),
    );
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const step of steps) {
  if (step.eval) console.log("eval:", JSON.stringify(await evaluate(step.eval)));
  if (step.hash) {
    await evaluate(`location.hash = ${JSON.stringify(step.hash)}`);
    await sleep(500);
  }
  if (step.click) {
    const box =
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(step.click)});
      if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!box) throw new Error(`not found: ${step.click}`);
    for (const type of ["mousePressed", "mouseReleased"])
      await send("Input.dispatchMouseEvent", {
        type,
        x: box.x,
        y: box.y,
        button: "left",
        clickCount: 1,
      });
    await sleep(250);
  }
  if (step.drag) {
    // {"drag": {"from": sel, "to": sel}} — pointer drag in small steps (dnd-kit needs movement)
    const pt = async (sel) =>
      evaluate(
        `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 20) }; })()`,
      );
    const a = await pt(step.drag.from),
      b = await pt(step.drag.to);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: a.x,
      y: a.y,
      button: "left",
      clickCount: 1,
    });
    for (let i = 1; i <= 15; i++) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: a.x + ((b.x - a.x) * i) / 15,
        y: a.y + ((b.y - a.y) * i) / 15,
        button: "left",
        buttons: 1,
      });
      await sleep(30);
    }
    await sleep(150);
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: b.x,
      y: b.y,
      button: "left",
      clickCount: 1,
    });
    await sleep(600);
  }
  if (step.type) await send("Input.insertText", { text: step.type });
  if (step.key) {
    const mods = step.ctrl ? 2 : 0;
    const named = {
      Enter: [13, "Enter"],
      Escape: [27, "Escape"],
      Tab: [9, "Tab"],
      " ": [32, "Space"],
      ArrowRight: [39, "ArrowRight"],
      ArrowLeft: [37, "ArrowLeft"],
      ArrowDown: [40, "ArrowDown"],
      ArrowUp: [38, "ArrowUp"],
    }[step.key];
    const code = named ? named[1] : `Key${step.key.toUpperCase()}`;
    const vk = named ? named[0] : step.key.toUpperCase().charCodeAt(0);
    for (const type of ["rawKeyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", {
        type,
        key: step.key,
        code,
        modifiers: mods,
        windowsVirtualKeyCode: vk,
        ...(step.key === "Enter" && type === "rawKeyDown" ? { text: "\r" } : {}),
      });
    await sleep(250);
  }
  if (step.wait) await sleep(step.wait);
  if (step.shot) {
    const r = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(step.shot, Buffer.from(r.data, "base64"));
    console.log("shot:", step.shot);
  }
}
ws.close();
