# Task Manager API — Backend (Practical 4–7)

Node.js + Express + MongoDB (Mongoose) REST API for the Task Manager full-stack
application — **Advanced Web Development Frameworks (ITUE301)**.

Serves the React frontend in [`../Dhairya`](../Dhairya).

```
React Frontend (localhost:5173)
        | fetch API calls
        v
Express Backend (localhost:5000)
        | Mongoose
        v
MongoDB (mongodb://127.0.0.1:27017/task-manager-api)
```

## Features

- User registration and login with **bcrypt** password hashing
- **JWT** authentication — `/tasks` routes are protected via `authMiddleware`
- Full CRUD for tasks, persisted in MongoDB (survives browser refresh)
- Task validation middleware (title/description/priority) on POST/PUT
- Global error handler mapping Mongoose `ValidationError` / `CastError` to clean JSON
- CORS enabled for the Vite dev server origin
- Request logging middleware

## Getting Started

```bash
cd task-manager-api-24IT090
npm install
npm start          # http://localhost:5000
```

Requires MongoDB running locally (default: `mongodb://127.0.0.1:27017`).
Optional: copy `.env.example` to `.env` to override `PORT` / `MONGO_URI`.

## API Endpoints

### Auth (public)

| Method | Endpoint   | Description                          |
|--------|------------|--------------------------------------|
| POST   | `/register`| Create an account                    |
| POST   | `/login`   | Log in, returns a JWT token          |
| GET    | `/me`      | Current user (JWT required)          |

### Tasks (JWT required — send `Authorization: Bearer <token>`)

| Method | Endpoint        | Description                  |
|--------|-----------------|------------------------------|
| GET    | `/tasks`        | List all tasks from MongoDB  |
| GET    | `/tasks/:id`    | Get a single task            |
| POST   | `/tasks`        | Create a task                |
| PUT    | `/tasks/:id`    | Update a task                |
| DELETE | `/tasks/:id`    | Delete a task                |

Example task payload:

```json
{
  "title": "Finish practical",
  "description": "Wire React to the Express API",
  "priority": "high"
}
```

---

## 🚀 Practical 8 — Performance Optimization & Lazy Loading (NO CODE CHANGES HERE)

> **Status: documentation-only for this repo.**
> **Practical 8: Performance Optimization and Lazy Loading in React (CO1 / PO3, PO5)** is a
> **frontend-only** practical — it targets the React app in [`../Dhairya`](../Dhairya),
> specifically `src/App.jsx` (route-based `React.lazy()` + `Suspense`).

### Why this backend is untouched

- **Code splitting is a build-time frontend concern.** Vite splits the JavaScript bundle;
  this Express API has no JavaScript bundle to split.
- **The API contract does not change.** All endpoints, payloads, status codes and auth
  behavior are identical before and after the optimization — the frontend simply ships
  less JavaScript on first load.
- **This API is the data layer under test.** During Practical 8 it stays running exactly
  as documented above so the lazy-loaded **Tasks** route can be verified end-to-end
  (navigate → chunk loads → fetches from this API).

### Role in the Practical 8 evidence

| Evidence item | Where this API participates |
|---|---|
| Baseline / after Network-tab captures | Both captures run against this same API — no server-side variable in the comparison |
| Lazy `/tasks` route verification | `GET /tasks` must respond identically after the chunk loads |
| Fallback UI under Slow 3G | API latency is unaffected; throttling only simulates slow asset download |

Full plan, metrics tables and viva prep: [`../MASTER_CONTEXT.md`](../MASTER_CONTEXT.md).
Frontend changes: [`../Dhairya/README.md`](../Dhairya/README.md) → Practical 8 section.

---

## ⚡ Practical 9 — Server-Side Caching & Performance Measurement

> **Practical 9: Server-Side Caching and Response Time Optimization (CO1, CO2 / PO3, PO5)**  
> **Repository:** `task-manager-api-24IT090` (Backend-only optimization)  
> **Status:** ✅ Completed, Benchmarked & Verified  

---

### 1. Caching Strategy Overview

To eliminate redundant database lookups on high-frequency read routes, we introduced an in-memory caching layer using **`node-cache`**.

```
Client (React / cURL / Postman)
             │
             ▼
    GET /tasks (with JWT)
             │
             ├──► [Cache Hit?] ──YES──► Return cached JSON (~4 ms)
             │
             └──► [Cache Miss] ───────► Query MongoDB (~8.4 ms)
                                             │
                                             ▼
                                      Store in cache (TTL: 60s)
                                             │
                                             ▼
                                      Return JSON to client
```

#### Architecture Details

- **Cache Engine:** `node-cache` configured with standard TTL of **60 seconds** (`stdTTL: 60`) and periodic cleanup every **120 seconds** (`checkperiod: 120`).
- **Cache Module:** Encapsulated in [`cache.js`](cache.js) exporting `get(key)`, `set(key, val, [ttl])`, `del(key)`, `flush()`, and `getStats()`.
- **Per-User Scoped Keys:** Since each authenticated user owns their tasks, the collection cache key is dynamic:
  ```javascript
  const cacheKey = req.user && req.user.id ? `tasks_${req.user.id}` : "all_tasks";
  ```
  This prevents tenant data leakage while caching results for each distinct user.
- **Single-Item Caching:** `GET /tasks/:id` is cached under `task_${req.params.id}`.
- **Cache Invalidation on Mutation (Write-Through Purge):**
  - `POST /tasks` (Create) → invalidates `tasks_${req.user.id}` and `all_tasks`.
  - `PUT /tasks/:id` (Update) → invalidates `tasks_${req.user.id}`, `all_tasks`, and `task_${id}`.
  - `DELETE /tasks/:id` (Delete) → invalidates `tasks_${req.user.id}`, `all_tasks`, and `task_${id}`.
- **Observability Endpoint:** Exposes `GET /debug/cache-stats` returning hit/miss counters, hit ratio, and active cached keys.

---

### 2. Performance Measurement & Benchmark Results

All response times were measured using Node.js high-resolution timers (`performance.now()`) against the local MongoDB instance on `127.0.0.1:27017` with authenticated JWT requests.

![Practical 9 Caching Metrics](docs/pr9-caching-metrics.png)

#### Response Time Comparison Table

| Metric / Run | Baseline (Uncached - Direct MongoDB) | Optimized (Cached - In-Memory RAM) | Improvement |
|:---|:---:|:---:|:---:|
| **Reading 1** | `11.87 ms` | `3.42 ms` | -71.2% |
| **Reading 2** | `6.64 ms` | `4.99 ms` | -24.8% |
| **Reading 3** | `6.67 ms` | `3.96 ms` | -40.6% |
| **Average Response Time** | **`8.39 ms`** | **`4.12 ms`** | **`50.8% Speedup (2.0x faster)`** |

- **Cache Hit Ratio:** **`75.0%`** (3 hits on 4 total reads).
- **Database Load Reduction:** Subsequent read requests bypass Mongoose query construction, connection pooling, and BSON deserialization entirely.

---

### 3. Viva & Lab Questions Answered

#### Q1: Why is cache invalidation on write necessary? What bug occurs if you only use TTL without invalidation?
> **Answer:**  
> Cache invalidation on write is essential to maintain **data consistency and cache coherency**.  
> If an application relies solely on TTL expiration without write invalidation, a **stale read bug** occurs:
> - When a user creates a new task (`POST /tasks`), updates a title (`PUT /tasks/:id`), or deletes a completed task (`DELETE /tasks/:id`), the database updates immediately.
> - However, subsequent `GET /tasks` calls will continue serving the old snapshot stored in memory until the 60-second TTL expires.
> - To the user, the UI appears broken or unresponsive (e.g. deleted tasks remain visible, new tasks do not appear). Explicit invalidation on mutation ensures mutations are immediately reflected on the next read without waiting for TTL expiration.

#### Q2: What are the trade-offs of a short TTL (e.g., 5 seconds) vs. a long TTL (e.g., 10 minutes)?
> **Answer:**  
> - **Short TTL (e.g., 5 seconds):**
>   - *Pros:* High data freshness; minimizes the impact of missed invalidation events or out-of-band updates; lower memory footprint as expired entries are quickly evicted.
>   - *Cons:* Lower cache hit ratio under moderate traffic; frequent cache misses cause cyclic database load spikes.
> - **Long TTL (e.g., 10 minutes):**
>   - *Pros:* Maximum database offloading; highest cache hit ratio under high-traffic read-heavy workloads; ultra-fast response times for frequently accessed datasets.
>   - *Cons:* Higher RAM consumption (cached objects remain in heap memory); high risk of serving stale data for up to 10 minutes if cache invalidation logic fails or if direct database updates occur outside the API.

#### Q3: Why is `node-cache` (in-memory) not suitable for multi-instance / clustered deployments, and what should be used instead?
> **Answer:**  
> `node-cache` stores cached values directly in the **V8 heap process memory** of a single Node.js process.  
> In modern production environments where the API is scaled horizontally (e.g., PM2 cluster mode, Docker containers, Kubernetes pods, or AWS ECS behind an Application Load Balancer):
> - Each server instance maintains its own separate, isolated in-memory cache.
> - If a client issues `POST /tasks` to **Instance A**, Instance A invalidates its local cache. However, **Instance B** and **Instance C** have no knowledge of this mutation.
> - If the user's next `GET /tasks` request is routed by the load balancer to Instance B, Instance B will return **stale data** (split-brain cache inconsistency).
> 
> **Production Solution:**  
> Replace local in-memory storage with a centralized, distributed cache such as **Redis** or **Memcached**.  
> In a Redis architecture:
> - All Node.js instances connect over TCP to the same Redis cluster.
> - When Instance A performs an invalidation (`DEL tasks:userId`), all instances immediately see the evicted state.
> - Redis also supports TTL, LRU eviction policies, pub/sub invalidation broadcasts, and persistence to disk across application restarts.

---

### 4. Verification Checklist

- [x] Baseline response times captured (3 readings, average 8.39 ms)
- [x] `node-cache` package installed and initialized (`stdTTL: 60`, `checkperiod: 120`)
- [x] Dedicated `cache.js` helper module with hit/miss statistics tracking
- [x] `GET /tasks` cached with user-scoped key (`tasks_${userId}`)
- [x] Cache invalidation implemented on `POST /tasks`, `PUT /tasks/:id`, and `DELETE /tasks/:id`
- [x] Supplementary item: `GET /tasks/:id` cached with `task_${id}` key and invalidated on update/delete
- [x] Supplementary item: `GET /debug/cache-stats` endpoint implemented for cache inspection
- [x] Verified zero stale reads immediately after task creation, update, and deletion
- [x] Cached response times captured (3 readings, average 4.12 ms; 50.8% speedup)
- [x] Performance metrics card rendered and saved to [`docs/pr9-caching-metrics.png`](docs/pr9-caching-metrics.png)
- [x] Comprehensive documentation and viva questions added to `README.md`
- [x] Zero changes made to frontend (`Dhairya/`)

---

## 📡 Practical 10 — Asynchronous Processing with Event-Driven Architecture

> **Practical 10: Asynchronous Processing with Event-Driven Architecture (CO4 / PO3, PO5)**  
> **Repository:** `task-manager-api-24IT090` (Backend-only)  
> **Status:** ✅ Implemented & verified at module level — Postman evidence pending (see §5)  
> **Frontend: no changes in Practical 10.**

### Objective

Move the slow "notification" work (email/SMS simulation) **off the critical request path**
using Node.js's built-in `EventEmitter` — no external queues (RabbitMQ/Bull/Redis), no new
npm dependencies. When a task is created, the API saves it, invalidates the cache (Practical 9,
unchanged), responds `201` immediately, and only *then* does a background listener perform the
slow notification. Provable via console timestamps and Postman response times.

### 1. Architecture

```
Client (Postman / React)
        │
        │ POST /tasks (JWT)
        ▼
authMiddleware → validateTask → taskController.createTask
        │
        │ 1. Task.create(...)                      (owner-scoped, MongoDB)
        │ 2. cache.del(tasks_<userId> / all_tasks) (Practical 9 invalidation, unchanged)
        │ 3. res.status(201).json(task)  ◄── CLIENT UNBLOCKED HERE (tens of ms)
        │
        │ 4. taskEvents.emit('task-created', payload)   (never awaited)
        ▼
EventEmitter singleton (events.js, in-process, captureRejections: true)
        │
        ├── 'task-created' → listeners.js handler (BACKGROUND):
        │       log STARTED → await setTimeout(NOTIFICATION_DELAY_MS)
        │       → User.findById (email lookup off the critical path)
        │       → log DONE ... +N ms after API response
        │
        └── 'error' → log [Notification:error] (captureRejections safety net)

DELETE /tasks/:id → res 200 → emit('task-deleted') → [Notification] Task "X" was deleted ...
```

### 2. Files Added / Changed

| File | Status | Purpose |
|---|---|---|
| `events.js` | ➕ added | `EventEmitter` singleton; `captureRejections: true` routes async listener failures to `'error'` |
| `listeners.js` | ➕ added | All listeners registered **once**: `task-created` (async handler), `task-deleted`, `error` |
| `server.js` | ✏️ changed | `require('./listeners')` exactly once at startup (after `dotenv.config()`, before `app.listen`) |
| `controllers/taskController.js` | ✏️ changed | `createTask`/`deleteTask` emit **after** the response; demo-only sync comparison mode |
| `.env.example` | ✏️ changed | Three demo knobs (below) |
| `docs/TaskManager_Practical_API.postman_collection.json` | ✏️ changed | New folder **"04 - Practical 10 – Events"** (7 requests) |
| `docs/PRACTICAL_10_POSTMAN_SCREENSHOT_GUIDE.md` | ➕ added | Defines the `pr10-*.png` evidence filenames |
| `docs/pr10-*.png` | ⏳ pending | 9 screenshots — capture per the guide |

### 3. Configuration (`.env` — see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `NOTIFICATION_DELAY_MS` | `2000` | Simulated slow notification job; `0` disables the delay |
| `NOTIFICATION_MODE` | `async` | `sync` = demo-only control experiment (handler runs *before* the response) |
| `SIMULATE_LISTENER_ERROR` | `false` | `true` = `task-created` handler throws, demonstrating the `error` listener |

### 4. Ordering Guarantee (how it works)

`emit()` calls listeners **synchronously**, but the listener's slow part is
`await setTimeout(...)`, which yields the single event-loop thread immediately, so `emit()`
returns at once. Crucially, `res.status(201).json(task)` executes **before** `emit()` — the
response is already handed to the socket. This is *interleaving on one thread, not
parallelism*: a CPU-bound listener (busy loop, large JSON parse, crypto) would still block
every request — that's what `worker_threads` or an external worker are for.

### 5. Evidence — `POST /tasks` response time (Postman "Time")

> ⚠️ **TODO (fill from my Postman run)** — this implementation environment has no MongoDB /
> Postman, so the numbers below must come from a real run on the dev machine. Do not invent
> values. Baseline = same request with these changes `git stash`-ed.

| Mode | Reading 1 | Reading 2 | Reading 3 | Average |
|---|---|---|---|---|
| Baseline (before Practical 10 code) | `TODO (my Postman run)` | `TODO` | `TODO` | `TODO` |
| **async** (default, `NOTIFICATION_DELAY_MS=2000`) | `TODO (my Postman run)` | `TODO` | `TODO` | `TODO` |
| **sync** (`NOTIFICATION_MODE=sync`, control experiment) | `TODO (my Postman run)` | `TODO` | `TODO` | `TODO` |

Expected: async ≈ baseline (tens of ms, tests assert `< 500 ms`); sync ≈ +`NOTIFICATION_DELAY_MS`.

### 6. Console Log Evidence

**Async ordering** (what to capture — `TODO (fill from my server console)`):

```text
TODO  [API] POST /tasks -> 201 response sent at 20XX-..Z
TODO  [Notification] handler STARTED at 20XX-..Z
      (≈ 2000 ms gap — client already has its 201)
TODO  [Notification] handler DONE 20XX-..Z | Task "Practical 10 Event Demo Task" | user: <email> | +~2000 ms after API response
```

**Error listener** — verified during implementation (module-level harness run of the real
`events.js`/`listeners.js` code; no HTTP/DB in that environment, hence the id fallback):

```text
[Events] Registered listeners: task-created, task-deleted, error
[Notification] handler STARTED at 2026-09-30T04:41:31.981Z
[Notification:error] Simulated notification failure
(process still alive — server would keep serving; next request works)
```

**Invalid body → no event** (`TODO (fill from my server console)`):

```text
TODO  POST /tasks 400  ...   ← NO [Notification] lines for this request
```

### 7. Screenshots (capture per [`docs/PRACTICAL_10_POSTMAN_SCREENSHOT_GUIDE.md`](docs/PRACTICAL_10_POSTMAN_SCREENSHOT_GUIDE.md))

| Filename | Content |
|---|---|
| `docs/pr10-baseline-create-timing.png` | Pre-Practical-10 POST time |
| `docs/pr10-async-create-timing.png` | POST 201 in tens of ms while the 2 s notification runs |
| `docs/pr10-console-ordering.png` | `[API] … response sent` before `[Notification] handler DONE` |
| `docs/pr10-sync-create-timing.png` | Sync mode ≈ +2000 ms (control) |
| `docs/pr10-error-listener.png` | `SIMULATE_LISTENER_ERROR=true`: still 201, error logged, server alive |
| `docs/pr10-invalid-400-no-event.png` | 400 envelope, zero notification logs |
| `docs/pr10-noauth-401-no-event.png` | 401, zero notification logs |
| `docs/pr10-delete-notification.png` | 200 delete + `[Notification] Task "…" was deleted …` |
| `docs/pr10-cache-regression.png` | Fresh `GET /tasks` shows the new task + `cache-stats` 200 |

### 8. Viva Q&A

**Q1. Why doesn't emitting block the response, if both run on one Node process?**  
`emit()` invokes listeners synchronously, but our listener's slow part is `await setTimeout`,
which hands control back to the event loop immediately, so `emit()` returns at once. Also
`res.json()` runs *before* `emit()`, so the response is already handed to the socket. This is
**interleaving on one thread, not parallelism** — a CPU-bound listener (busy loop, big JSON
parse, crypto) would still block every request; that needs `worker_threads` or an external worker.

**Q2. What if the notification logic were inside the POST route?**  
The client would wait for it: response time ≈ DB time + notification time (≈ +2000 ms here).
Evidence: the sync-mode row in §5 (`NOTIFICATION_MODE=sync` awaits the handler before responding).

**Q3. Why is EventEmitter fine here but not for millions of events/day?**  
It is in-process and in-memory: events are lost on crash/restart; there is no persistence, no
retries or dead-letter queue, no backpressure; it shares CPU/memory with the API; and it does
not work across multiple server instances (same limitation as `node-cache` in Practical 9),
with little observability. Production scale → BullMQ/Redis, RabbitMQ, Kafka, or SQS.

**Q4. Why register an `error` listener?**  
An `'error'` event with **no** listener throws and can crash the process, so one must always
exist; it logs `[Notification:error]` and never rethrows. `captureRejections: true` additionally
routes rejected promises from async listeners to that same listener.

**Q5. Link to Practical 9.**  
Both features take work off the critical request path: caching removes *reads* from the DB path,
events remove *side effects* from the response path — the client only ever waits for the
mandatory core (auth + validation + DB write).

### 9. Mistakes Avoided

| Common mistake | How it was avoided |
|---|---|
| Notification logic inside the route (blocking) | Route only `emit`s; logic lives in `listeners.js` |
| `await`ing the emit / wrapping in `Promise.all` | Fire-and-forget `emit`, wrapped in its own `try/catch` |
| Busy `while` loop for the delay | `await new Promise(r => setTimeout(r, ms))` — yields the event loop instead of freezing the whole API |
| Emitting before the response | Emit is strictly **after** `res.status(201).json(...)` |
| `next(err)` after the response was sent | Emit wrapped locally; `next` never called post-response (avoids `ERR_HTTP_HEADERS_SENT`) |
| Requiring `listeners.js` from multiple files / routes | Single `require` in `server.js`; emitter-level `listenerCount` guard blocks duplicate registration even under require-cache clearing |
| Missing `'error'` listener | Always registered third; `captureRejections` routes async failures there |
| Passing the Mongoose document in the payload | Plain snapshot `{ _id, title, priority, user, createdAt, responseSentAtMs }` |
| Fabricating timings/screenshots | `TODO` placeholders until real Postman runs (§5–§7) |

### 10. Reflection — errors hit during implementation

| # | What happened | How it was fixed |
|---|---|---|
| 1 | The `error` listener never logged during the first harness run: the `task-created` listener wrapper called `handleTaskCreated(payload).catch(() => {})`, which **swallowed the rejection** before `captureRejections` could route it to `'error'` | Listener now **returns** the handler promise; re-run confirmed `[Notification:error] Simulated notification failure` logs and the process survives |
| 2 | In the new sync-demo branch, `payload.responseSentAtMs` stayed at its initial `0`, which would have printed a bogus multi-year lag in the DONE log | `responseSentAtMs` is now set immediately before awaiting the handler in the sync branch (caught in self-review, before any run) |

### 11. Contract & Regression Notes

- **API contract unchanged** (MASTER_CONTEXT §5): status codes, bodies and error envelopes of
  every existing route are byte-identical; events are a side effect only.
- Practical 9 caching untouched: invalidation still runs **before** the response; `cache.js`
  behavior unchanged; verified boot shows `[Events] Registered listeners: task-created,
  task-deleted, error` exactly once.
- Ownership scoping unchanged: all queries still `ownerFilter(req)`-scoped; client-supplied
  `user` still stripped; 404 deletes emit nothing.

