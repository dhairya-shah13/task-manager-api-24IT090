# Practical 10 — Postman Screenshot Guide

Defines the exact `docs/pr10-*.png` filenames referenced in `README.md` (Practical 10
evidence) and how to capture each one. Import
[`TaskManager_Practical_API.postman_collection.json`](TaskManager_Practical_API.postman_collection.json)
and use the **"04 - Practical 10 – Events"** folder.

## 0. One-time setup

| Variable | Where | Value |
|---|---|---|
| `baseUrl` | Environment | `http://localhost:5000` |
| `email` | Environment | your test email (e.g. `pr10@example.com`) |
| `password` | Environment | your test password (min 6 chars) |
| `token` | Environment | *auto-saved* by **P10-2. Login** test script |
| `taskId` | Environment | *auto-saved* by **P10-3. Create Task** test script |

Start the backend (`npm start`). Baseline screenshots need the code **before** this
practical: `git stash` (or `git checkout <commit>^`) first, and skip P10-5 onward.

## 1. Run order (async mode — default)

`.env`: `NOTIFICATION_DELAY_MS=2000`, `NOTIFICATION_MODE=async`, `SIMULATE_LISTENER_ERROR=false`

1. `P10-1. Register User` → 201/409 (either proves the account exists)
2. `P10-2. Login (Saves Token)` → 200, `token` variable set
3. `P10-3. Create Task (Emits task-created AFTER 201)` → **201, Time ≈ tens of ms**, all 4 tests green
4. `P10-4. Create Task – Invalid (400, No Event)` → 400 envelope
5. `P10-5. Delete Task ({{taskId}}, Emits task-deleted)` → 200 `{success, message}`
6. `P10-6. Get Tasks` → array; `P10-7. Cache Stats` → counters

## 2. Screenshots to capture

| # | Filename | What must be visible | Collection request |
|---|---|---|---|
| 1 | `pr10-baseline-create-timing.png` | POST /tasks **before this practical** — 201 + Postman **Time** (baseline column of the evidence table) | P10-3 body on pre-P10 code |
| 2 | `pr10-async-create-timing.png` | 201 + **Time ≈ tens of ms** (< 500 ms) + all tests green — proves the 2 s notification did NOT block | P10-3 |
| 3 | `pr10-console-ordering.png` | Server console: `[API] POST /tasks -> 201 response sent at …` → `[Notification] handler STARTED …` → ≈2 s gap → `[Notification] handler DONE … +~2000 ms after API response` | after step 3 |
| 4 | `pr10-sync-create-timing.png` | Same request with `NOTIFICATION_MODE=sync` — **Time ≈ 2000+ ms** (control experiment) | P10-3 |
| 5 | `pr10-error-listener.png` | `.env` → `SIMULATE_LISTENER_ERROR=true`, restart, repeat step 3: Postman still **201** AND console shows `[Notification:error] Simulated notification failure`, server keeps running (next request works) | P10-3 + P10-6 |
| 6 | `pr10-invalid-400-no-event.png` | **400** with the error envelope AND console shows **no** `[Notification]` lines for this request | P10-4 |
| 7 | `pr10-noauth-401-no-event.png` | `GET /tasks` **without** token → 401, console shows no notification activity | request 4 of folder 01 |
| 8 | `pr10-delete-notification.png` | **200** `{success:true, message:"Task deleted successfully"}` AND console shows `[Notification] Task "…" was deleted by user …` | P10-5 |
| 9 | `pr10-cache-regression.png` | `P10-6 Get Tasks` response **includes the new task** (no stale read) + `P10-7 Cache Stats` 200 | P10-6 + P10-7 |

Paste the PNGs into this `docs/` folder with exactly these names, then tick the
README evidence checklist. Do not fabricate timings — every number in the README's
evidence table must come from the runs you screenshot here.
