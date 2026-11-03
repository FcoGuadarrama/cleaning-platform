# Contracts

| Contract | Source of truth | Regenerate |
|---|---|---|
| HTTP API (OpenAPI 3.1) | `openapi.json`, exported from FastAPI (`apps/api/app/export_openapi.py`, sorted keys) | `cd apps/api && uv run python -m app.export_openapi` |
| TS types/client | `packages/api-client/src/schema.d.ts` (openapi-typescript 7.13.0, never hand-edited) | `pnpm --filter @repo/api-client generate` |
| Design tokens | `packages/design-tokens/src/brand.json` (+ `brand.schema.json`) → `dist/*` | `pnpm --filter @repo/design-tokens build` |

CI fails if regeneration changes any tracked file (`pnpm check:drift`, contract export step).

## Browser access

The API enables CORS only for origins explicitly listed in the comma-separated `CORS_ORIGINS`
environment variable. For local Expo web development, start Uvicorn with
`CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081`. Match the actual Expo origin,
including its port. Restart the API after changing this environment variable.
The mobile client uses `EXPO_PUBLIC_API_URL` (default `http://127.0.0.1:8000`);
restart Expo after changing it. Native devices need a reachable host address.
The dashboard uses its Vite `/api` proxy during development.
Tasks record `sha256sum docs/contracts/openapi.json` in `WORKTREE_STATE.md`; the supervisor flags mismatches.

## Operation IDs
Stable `<tag>_<action>` route names (e.g. `bookings_create_hold`). Renaming one is a breaking change.

## Error contract
Every non-2xx app error body is `ErrorResponse {code, message, details?}` (statuses 400/401/403/404/409; 422 is
FastAPI validation). Clients branch on `code`, never on `message` (message is not localized copy).

| Status | Codes |
|---|---|
| 400 | `not_business_day` `outside_working_hours` `start_in_past` `gps_incomplete` `gps_inconsistent` `invalid_capture_status` `invalid_week_start` `invalid_signature` `unknown_payment` |
| 401 | `unauthenticated` `invalid_credentials` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `slot_unavailable` `hold_expired` `booking_not_payable` `already_paid` `invalid_booking_state` `attendance_exists` `exception_resolved` `settlement_exists` `nothing_to_settle` `mixed_currency` `email_taken` |

## State contracts
Booking, payment, attendance capture, earning and settlement states/transitions: see `docs/DOMAIN.md#states`.
Adding a state value is a contract change (regenerate client, update both consumers).

## Events
Inbound: sandbox payment webhook `payments_sandbox_webhook`, HMAC-SHA256 of the raw body with
`SANDBOX_WEBHOOK_SECRET`, idempotent on (`provider`, `event_id`). No outbound events yet.
