---
name: OPUSOL API boundary
description: Product constraint for integration with the independently developed OPUSOL backend.
---

The frontend can provide a clearly marked demo experience, but authentication, membership permissions, balances, split outcomes, and settlement suggestions must come from the API. Treat proposed routes and payloads as unconfirmed until the backend owner agrees to them. Never claim authentication or real shared data works before that integration is implemented.

**Why:** the product brief assigns backend development independently and explicitly says not to claim backend functionality without a connection.

**How to apply:** keep demo data isolated from API mode; surface connection and API errors explicitly; do not add competing frontend balance or settlement calculations.
