# OPUSOL API contract — proposal, not confirmed

This document records a frontend integration proposal for the independently developed API. **No endpoint below is claimed to exist.** Confirm this contract with the backend owner before implementing callers or changing the API server.

## Shared expectations to confirm

- Base URL comes from `VITE_API_BASE_URL`; the frontend request helper sends cookies with `credentials: include`.
- Proposed JSON error shape: `{ "message": "Human-readable error" }`.
- Prefer integer minor units (paise) for money and ISO-8601 timestamps.
- The API is authoritative for user identity, permissions, balances, split results, and settlement suggestions. The browser must not derive or persist these in real mode.
- Confirm whether auth uses secure same-site cookies, bearer tokens, or another method. The current UI neither stores passwords nor creates a session.
- Every route and payload in this document is **unconfirmed**.

## Proposed routes

| Method | Proposed path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/logout` | End session |
| GET | `/auth/me` | Load current session/user |
| GET | `/dashboard` | Summary balances, groups, recent expenses |
| GET / POST | `/groups` | List or create groups |
| GET / PATCH / DELETE | `/groups/:groupId` | Read/update/archive a group |
| POST | `/groups/:groupId/leave` | Leave group |
| POST | `/groups/:groupId/leave-requests` | Request to leave when direct leave is disallowed |
| GET / POST | `/groups/:groupId/expenses` | List or create group expenses |
| PATCH / DELETE | `/expenses/:expenseId` | Edit or remove expense, subject to permissions |
| GET | `/groups/:groupId/balances` | Authoritative balances and proposed settlements |
| POST | `/settlements` | Record a settlement, if supported |

## Proposed expense input

```json
{
  "description": "Dinner",
  "amountMinor": 248000,
  "currency": "INR",
  "paidByUserId": "user-id",
  "splitType": "equal",
  "participants": [{ "userId": "user-id" }]
}
```

Possible split types are `equal`, `exact`, and `percentage`. The API owner must define validation, participant eligibility, deterministic paise remainder allocation, and how exact/percentage values are represented. Until then, the frontend does not calculate shares.

## Proposed records to align on

```ts
type User = { id: string; name: string; email: string };
type Group = { id: string; name: string; description?: string; members: User[] };
type Expense = {
  id: string; groupId: string; description: string; amountMinor: number;
  currency: string; paidByUserId: string; createdAt: string;
};
type BalanceSummary = {
  currency: string; netMinor: number; owesMinor: number; owedMinor: number;
};
```

The final response envelope, pagination, ID format, group roles, member actions, and settlement lifecycle remain open questions.

## Current frontend behavior

- Demo mode is separate local sample data and never falls back after an API error.
- Real sign-in, registration, group membership actions, expense writes, and settlements remain unavailable until the API owner confirms the contract and the client is wired to it.
- The centralized helper provides base URL handling, cookie credentials, JSON errors, and network errors, but does not imply server support.
