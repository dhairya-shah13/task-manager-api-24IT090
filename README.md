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
