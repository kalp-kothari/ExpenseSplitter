# OPUSOL

OPUSOL is a responsive shared-expenses frontend. Until the API is connected, it opens in **Demo Mode**: sample records are visibly labeled, and demo group/expense additions are stored only in this browser. Demo data is not shared or authoritative.

## Development

Run the existing workspace workflow or use `pnpm --filter @workspace/settle run dev`.

## Modes

- `VITE_DEMO_MODE` defaults to enabled. Set it to `false` to disable sample data and local demo mutations.
- `VITE_API_BASE_URL` configures the API origin for the centralized request helper in `src/lib/api.ts`.
- Login and registration currently validate the form but do not authenticate or persist credentials. They clearly report that the API integration is not connected.
- Expense balances and settlement suggestions are not calculated by the frontend. Dashboard balance tiles are sample values; settlement pages explicitly require backend data.

## Backend integration

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for proposed endpoints and data shapes. These are discussion material, not an agreed or implemented contract. Confirm auth strategy, route names, payloads, response envelopes, authorization rules, and split-rounding behavior with the API owner before wiring features to those routes.
