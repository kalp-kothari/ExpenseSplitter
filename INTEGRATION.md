# Expense Splitter — Frontend & Backend Integration Guide

**Team:** The Opusol  
**Status:** Connected & Verified Locally (No git push)

---

## 1. Architecture Overview

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Radix UI + Wouter (`artifacts/settle`).
- **Backend:** Node.js + Express + PostgreSQL (`pg` pool) + JWT Authentication + bcrypt (`backend/`).
- **Communication:**
  - In local development, the Vite server proxies `/api/*` to `http://localhost:5000`.
  - Alternatively, cross-origin requests connect directly via `VITE_API_BASE_URL=http://localhost:5000` with pre-configured permissive CORS supporting `localhost`, `127.0.0.1`, and `*.replit.dev` domains.
  - Authentication tokens (JWT) are saved in browser storage (`opusol-token`) and automatically dispatched via `Authorization: Bearer <token>`.
  - Offline/Demo Mode is seamlessly maintained as a fallback if the backend is not logged in or during initial discovery.

---

## 2. Connected Features

| Feature | Backend Endpoint | Frontend UI Action |
| --- | --- | --- |
| **User Registration** | `POST /api/auth/register` | Register page (`/register`) with name, email, password |
| **User Sign In** | `POST /api/auth/login` | Login page (`/login`) with email, password |
| **Session Verification** | `GET /api/auth/me` | On app load, validates token and sets user profile |
| **List User Groups** | `GET /api/groups` | Dashboard and `/groups` views with member counts and totals |
| **Create Group** | `POST /api/groups` | "Create group" modal |
| **Group Details & Members** | `GET /api/groups/:id`, `GET /api/groups/:id/members` | `/groups/:id` detail page |
| **Add Member** | `POST /api/groups/:id/members` | "Add Member" modal inviting by registered email |
| **Group Balances** | `GET /api/groups/:id/balances` | "Current Balances" card in group detail |
| **Settlement Suggestions** | `GET /api/groups/:id/settlements/suggestions` | "Suggested Settlements" card in group detail |
| **Record Settlement** | `POST /api/groups/:id/settlements` | "Settle Up" action to record a pending transaction |
| **List Settlements** | `GET /api/groups/:id/settlements` | `/settlements` page |
| **Confirm / Cancel Settlement** | `PATCH /api/settlements/:id` | "Confirm" / "Cancel" buttons for pending settlements |
| **Add Expense** | `POST /api/groups/:id/expenses` | "Add expense" modal with equal splits across group members |
| **Delete Expense** | `DELETE /api/expenses/:id` | Trash icon on user-created expenses in `/expenses` |
| **Leave Group** | `POST /api/groups/:id/leave-requests` | "Leave group" modal (auto-approved on 0 balance; submitted to creator on debt) |

---

## 3. How to Run Locally

### Start Backend:
```bash
# Terminal 1: Run PostgreSQL migrations (if using real DB) and start server
cd backend
npm install
npm run dev
# Backend starts on http://localhost:5000
```

### Start Frontend:
```bash
# Terminal 2: Run frontend dev server
pnpm --filter @workspace/settle run dev
# Frontend starts on http://localhost:5173 (or assigned port)
```

### Run Tests:
```bash
# Backend unit & integration test suite (66 tests)
cd backend
npm test

# Frontend TypeScript verification
pnpm run typecheck
```

---

## 4. Verification Check

- [x] Cloned `https://github.com/kalp-kothari/ExpenseSplitter.git`
- [x] Installed workspace dependencies with `pnpm`
- [x] Connected `api.ts` client to backend with JWT handling & typed methods
- [x] Configured Vite development proxy for `/api`
- [x] Connected `opusol.tsx` UI flows (Auth, Groups, Expenses, Balances, Settlements, Leave Requests)
- [x] Maintained Demo Mode as offline preview fallback
- [x] Verified full workspace TypeScript check (`pnpm run typecheck` passes with 0 errors)
- [x] Verified frontend build (`vite build` passes with 0 errors)
- [x] Verified backend test suite (`vitest run` passes 66/66 tests)
- [x] **Strictly adhered to instruction: NO `git push` was executed.**
