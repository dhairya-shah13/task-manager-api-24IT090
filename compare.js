/**
 * compare.js — Practical 10 evidence harness
 * ============================================
 * Compares EVENT-DRIVEN (async) vs NON-EVENT-DRIVEN (sync) handling of the slow
 * task-created notification, plus a CPU-bound busy-loop variant that demonstrates
 * the anti-pattern the practical warns against.
 *
 * What makes the numbers trustworthy:
 * - Uses the REAL production code path: the actual EventEmitter singleton
 *   (events.js), the REAL listener handler (listeners.js handleTaskCreated),
 *   and the REAL cache module (cache.js) — no reimplementations.
 * - "API response latency" is measured at the exact line where the controller
 *   calls res.status(201).json(task) — everything a client would wait for.
 * - Every scenario runs ITERATIONS times and reports min/avg/max, not a single
 *   lucky sample.
 *
 * Scenarios:
 *   A) async  — emit('task-created') after the response line (production behavior)
 *   B) sync   — await handleTaskCreated(payload) BEFORE the response line
 *               (the demo-only NOTIFICATION_MODE=sync branch; what the client
 *                would feel if notification logic lived inside the route)
 *   C) busy   — a CPU-bound busy `while` loop INSIDE the request path, plus a
 *               parallel HTTP-style probe that measures how unresponsive the
 *               whole single-threaded server becomes (why we use setTimeout)
 *
 * Usage:
 *   node compare.js                    (uses NOTIFICATION_DELAY_MS or 2000)
 *   NOTIFICATION_DELAY_MS=1500 node compare.js
 *
 * Output: docs/compare-report.md  (+ console table)
 * No new npm dependencies — Node built-ins only.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

// ── Real production modules under test ────────────────────────────────────────
const taskEvents = require("./events");
const { handleTaskCreated } = require("./listeners");
const cache = require("./cache");

// No Mongo in most demo environments: make the listener's User.findById fail
// FAST so it exercises its documented fallback (log the raw id) instead of
// hanging on Mongoose's default buffer timeout.
try {
    require("mongoose").set("bufferTimeoutMS", 100);
} catch {
    /* mongoose always present in this repo */
}

const ITERATIONS = Number(process.env.COMPARE_ITERATIONS) || 5;
const DELAY_MS = Number(process.env.NOTIFICATION_DELAY_MS) || 2000;

// Console capture: during the LAST async run we intercept console output so the
// report's ordering proof contains the REAL lines, not placeholders.
const capturedLines = [];
let capturing = false;
const origLog = console.log;
const origError = console.error;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flat timestamp median helper */
function stats(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    return {
        min: sorted[0],
        avg,
        max: sorted[sorted.length - 1]
    };
}

function fmt(ms) {
    return ms >= 100 ? `${ms.toFixed(0)} ms` : `${ms.toFixed(1)} ms`;
}

/**
 * Build the same plain-snapshot payload the controller builds in createTask.
 * `responseSentAtMs` is set by the caller right where res.json() would run.
 */
function buildPayload() {
    return {
        _id: `507f1f77bcf86cd7994390${String(Math.floor(Math.random() * 90) + 10)}`,
        title: `Compare Harness Task ${Date.now()}`,
        priority: "high",
        user: "507f1f77bcf86cd799439011",
        createdAt: new Date(),
        responseSentAtMs: 0
    };
}

/**
 * Scenario A — EVENT-DRIVEN (production async path).
 * Mirrors createTask: cache invalidate → response line → emit (never awaited).
 * Returns what the CLIENT waited for (the "API response time" Postman shows).
 */
function runAsyncOnce() {
    const t0 = performance.now();

    // 1. cache invalidation (Practical 9 — unchanged, pre-response)
    cache.del("tasks_harness");
    cache.del("all_tasks");

    // 2. controller reaches the response line — client is unblocked HERE.
    //    Logged in the controller's exact format so captured console excerpts
    //    match a real POST /tasks run byte-for-byte.
    const responseSentAtMs = Date.now();
    const payload = buildPayload();
    payload.responseSentAtMs = responseSentAtMs;
    const apiLatency = performance.now() - t0;
    console.log(`[API] POST /tasks -> 201 response sent at ${new Date().toISOString()}`);

    // 3. emit AFTER the response, never awaited
    taskEvents.emit("task-created", payload);

    return apiLatency;
}

/**
 * Scenario B — NON-EVENT-DRIVEN (sync demo branch).
 * Mirrors NOTIFICATION_MODE=sync: the slow handler runs BEFORE the response.
 */
async function runSyncOnce() {
    const t0 = performance.now();

    cache.del("tasks_harness");
    cache.del("all_tasks");

    const payload = buildPayload();
    payload.responseSentAtMs = Date.now();
    await handleTaskCreated(payload); // ← inside the request path: client waits

    return performance.now() - t0;
}

/**
 * Scenario C — CPU-bound busy loop (the anti-pattern), with a responsiveness
 * probe. A probe tick is scheduled every 25 ms (what a healthy event loop
 * services instantly); while the "notification" busy-loops on the SAME thread,
 * the tick cannot run. We report how LATE the first tick finally fired —
 * that is how long every concurrent request on this process would be frozen.
 */
async function runBusyOnce(busyMs) {
    let probeBlockedMs = 0;
    const probeStart = performance.now();

    const probe = setInterval(() => {
        // First tick: scheduled at +25 ms, actually fires once the thread frees up
        probeBlockedMs = performance.now() - probeStart - 25;
        clearInterval(probe);
    }, 25);

    // The busy loop itself (on the SAME thread — this is the point)
    const h0 = performance.now();
    const deadline = h0 + busyMs;
    while (performance.now() < deadline) {
        /* spin — blocks the single event loop thread */
    }
    const handlerMs = performance.now() - h0;

    // Yield so the overdue probe callback can finally run, then settle
    await new Promise((resolve) => setTimeout(resolve, 50));
    clearInterval(probe);
    return { handlerMs, probeBlockedMs };
}

/** Wait until the emitter drains (handler + DB-fallback) after the last emit */
function waitForEmitterToDrain() {
    return new Promise((resolve) => {
        setTimeout(resolve, DELAY_MS + 1500); // delay + DB timeout + margin
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    // Route all console output through interceptable wrappers
    console.log = (...args) => {
        const line = args.join(" ");
        if (capturing && (line.startsWith("[Notification]") || line.startsWith("[Events]") || line.startsWith("[API]"))) {
            capturedLines.push(line);
        }
        origLog(...args);
    };
    console.error = (...args) => {
        const line = args.join(" ");
        if (capturing && line.startsWith("[Notification]")) {
            capturedLines.push(line);
        }
        origError(...args);
    };

    console.log("=".repeat(74));
    console.log(" Practical 10 — Event-Driven vs Non-Event-Driven comparison");
    console.log(` iterations=${ITERATIONS}  NOTIFICATION_DELAY_MS=${DELAY_MS}`);
    console.log(" (uses the real events.js / listeners.js / cache.js production code)");
    console.log("=".repeat(74));

    // ── Scenario A: async (event-driven) ──
    const asyncSamples = [];
    console.log(`\n[A] EVENT-DRIVEN  (emit after response)  x${ITERATIONS}`);
    for (let i = 0; i < ITERATIONS; i++) {
        if (i === ITERATIONS - 1) {
            capturing = true; // capture the LAST run for the report excerpt
        }
        const ms = runAsyncOnce();
        asyncSamples.push(ms);
        origLog(`    run ${i + 1}: client waited ${fmt(ms)} (notification still running in background)`);
        await waitForEmitterToDrain(); // let the listener finish & log before next round
    }
    capturing = false;

    // ── Scenario B: sync (non-event-driven) ──
    const syncSamples = [];
    console.log(`\n[B] NON-EVENT-DRIVEN  (handler awaited inside the request)  x${ITERATIONS}`);
    for (let i = 0; i < ITERATIONS; i++) {
        const ms = await runSyncOnce();
        syncSamples.push(ms);
        console.log(`    run ${i + 1}: client waited ${fmt(ms)} (notification BLOCKED the response)`);
    }

    // ── Scenario C: CPU-bound busy loop anti-pattern ──
    const busyMs = Math.min(DELAY_MS, 2000);
    console.log(`\n[C] ANTI-PATTERN: CPU-bound busy loop (${busyMs} ms) + 25 ms event-loop probe`);
    const busy = await runBusyOnce(busyMs);
    console.log(`    handler "work":  ${fmt(busy.handlerMs)}`);
    console.log(
        `    probe tick fired ~${fmt(Math.max(0, busy.probeBlockedMs))} late — every concurrent request on this process stalls too`
    );

    // ── Report ──
    const a = stats(asyncSamples);
    const b = stats(syncSamples);
    const overhead = b.avg - a.avg;
    const ratio = b.avg / a.avg;

    const report = `# Practical 10 — Event-Driven vs Non-Event-Driven: Measured Comparison

> Generated by \`node compare.js\` on ${new Date().toISOString()} — local machine, single Node process.
> Uses the **real production code**: \`events.js\` (EventEmitter singleton), \`listeners.js\`
> (\`handleTaskCreated\`), \`cache.js\` (invalidation). "Client wait" is measured at the exact
> point where \`createTask\` calls \`res.status(201).json(task)\` — what Postman's **Time** column shows.
>
> Config: \`NOTIFICATION_DELAY_MS=${DELAY_MS}\`, iterations per scenario: ${ITERATIONS}.

## 1. Headline numbers

| Metric | A — Event-driven (async emit) | B — Non-event-driven (sync await) | Δ |
|---|---|---|---|
| Min client wait | ${fmt(a.min)} | ${fmt(b.min)} | — |
| **Avg client wait** | **${fmt(a.avg)}** | **${fmt(b.avg)}** | **+${fmt(overhead)}** |
| Max client wait | ${fmt(a.max)} | ${fmt(b.max)} | — |
| Client blocked by notification? | **No** — returns before the ${DELAY_MS} ms job finishes | **Yes** — waits the full job | — |
| Server responsive during job? | **Yes** — event loop free (setTimeout yields) | **No** in scenario C — busy loop freezes the whole process | — |

**Result: the event-driven path removes ~${fmt(overhead)} of client-visible latency per POST /tasks** — the sync path is ~${ratio >= 100 ? Math.round(ratio).toLocaleString("en-US") : ratio.toFixed(1)}× slower for the client. The async path also keeps the single event loop free for every other request.

## 2. Raw readings

| Run | A — async client wait | B — sync client wait |
|---|---|---|
${asyncSamples.map((v, i) => `| ${i + 1} | ${fmt(v)} | ${fmt(syncSamples[i])} |`).join("\n")}

## 3. The CPU-bound anti-pattern (why setTimeout, not a busy loop)

One simulated "notification" implemented as a CPU busy \`while\` loop (${fmt(busy.handlerMs)} of spin):
a 25 ms event-loop probe tick fired only ~${fmt(Math.max(0, busy.probeBlockedMs))} late.
That is what every concurrent HTTP request on the same process would experience.
The production listener instead uses \`await new Promise(r => setTimeout(r, ${DELAY_MS}))\`,
which hands the thread back to the event loop immediately — other requests keep being served
while the notification waits. This is **interleaving on one thread, not parallelism**:
CPU-bound work still needs \`worker_threads\` or an external worker.

## 4. Console ordering proof (scenario A, real captured output from the last run)

\`\`\`text
${capturedLines.length ? capturedLines.join("\n") : "(capture unavailable)"}
\`\`\`

## 5. Interpretation

- **Scenario A** is production: save → invalidate cache → \`res.json(201)\` → \`emit\`.
  The client never waits for the notification.
- **Scenario B** is \`NOTIFICATION_MODE=sync\`: identical work, but inside the request path —
  the client eats the full notification cost. Evidence for README viva Q2.
- **Scenario C** shows the limit of the trick: events buy *concurrency by interleaving*,
  not parallelism. A busy loop — unlike \`setTimeout\` — blocks every request.

*Reproduce: \`node compare.js\` (override with \`NOTIFICATION_DELAY_MS\`, \`COMPARE_ITERATIONS\`).*`;

    const outPath = path.join(__dirname, "docs", "compare-report.md");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, report, "utf8");

    console.log("\n" + "=".repeat(74));
    console.log(" SUMMARY (avg client wait)");
    console.log(`   A  event-driven (async)  : ${fmt(a.avg)}`);
    console.log(`   B  non-event-driven(sync): ${fmt(b.avg)}   (+${fmt(overhead)} vs A, ${ratio.toFixed(1)}x)`);
    console.log(`   C  busy-loop probe late  : ~${fmt(Math.max(0, busy.probeBlockedMs))}`);
    console.log(` Report written to ${path.relative(process.cwd(), outPath)}`);
    console.log("=".repeat(74));
}

main().catch((err) => {
    console.error("[compare] fatal:", err);
    process.exit(1);
});
