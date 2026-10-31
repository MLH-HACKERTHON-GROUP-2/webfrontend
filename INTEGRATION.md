# Live backend integration and optional simulation

Live mode defaults to **https://unstarched-maritally-ike.ngrok-free.dev/graphql**. Simulation is explicitly selected on the normal login page and uses the existing local service. These modes have separate session keys, caches and pending QR state; live errors never select simulation automatically.

## Live contract verified on 2026-10-31

The endpoint's introspection is saved as [backend/schema.live.graphql](backend/schema.live.graphql). All 26 documents in `lib/backend/live-operations.ts` validate against it. `npm run check:live` checks health and validates them against the current remote schema without authentication or clinical/financial writes.

The service exposes OTP auth, patient profiles/QR/records/wallets, active clinical sessions, vitals, diagnosis, prescriptions, finalization, pharmacy pricing/dispensing, and hospital/pharmacy/doctor onboarding. It has **no subscription type**, **no password-login operation**, **no staff QR pairing**, and **no scheduling, stock management, profile editing or reporting operations**. The `myWorkspace` JSON adapter exists only in simulation. Missing live features are clearly unavailable; no local placeholder writes are performed for them.

The old simulation account names are not authoritative live credentials. During integration checks, `doctor@emerald.care`, `pharmacy@emerald.care` and `system@emerald.care` resolved to PATIENT, not staff roles. Staff permissions must be provisioned by the live backend. Actual sign-in through the app/proxy and loading the patient portal passed. Authentication and read-only health/schema/profile requests were run against the remote service; no live clinical or payment writes were tested. Staff flows are covered by schema-validated fixtures until live staff accounts are supplied.

## Transport and configuration

The live service accepts GraphQL POST requests, but its CORS preflight returned HTTP 500 with no allow-origin headers. Browser requests therefore use a same-origin Next.js route at `/api/backend/`, which forwards to the fixed `LIVE_GRAPHQL_URL`, adds `ngrok-skip-browser-warning: true` and forwards only the bearer header and GraphQL body. The client cannot supply a target URL. The proxy limits request size, disables caching, rejects redirects, times out, and returns explicit connection errors. It never retries an ambiguous financial request.

A Next.js server runtime is required: the project no longer uses `output: 'export'`. Run `npm run build` / `npm start` for production, or `npm run dev` locally. The standalone static preview script is a legacy utility and is not the start command.

Optional `.env.local` (restart/rebuild Next.js after changes):

```dotenv
NEXT_PUBLIC_BACKEND_MODE=live
LIVE_GRAPHQL_URL=https://unstarched-maritally-ike.ngrok-free.dev/graphql
NEXT_PUBLIC_SIMULATION_GRAPHQL_URL=http://localhost:4000/graphql
```

The default mode is live unless explicitly configured/selected as simulation. `LIVE_GRAPHQL_URL` is read only on the server. Simulation directly uses its own HTTP/WS endpoint with existing origin checks. Live updates use explicit refresh, tab visibility and 15-second polling because subscriptions are absent.

## Live schema adapter

`lib/backend/live.ts` translates the established application DTOs/actions into actual backend requests. It never sends the simulation-only `myWorkspace`, `workspaceAction` or pairing operations to the live service.

| App concept | Live contract |
| --- | --- |
| Identifier | User has `email`/`phone`; normalize the entered identifier for UI/session display |
| Profile completion | `CompletePatientProfileInput {name, dob, sex, allergies}` returns Patient, then normalize its user |
| Heart rate / weight | `pulse` / `weightKg` inside `RecordVitalsInput`, with `sessionId` inside input |
| Clinical notes | `RecordVitalsInput.notes`; no separate clinical-note mutation exists |
| Diagnosis | `RecordDiagnosisInput {sessionId, code, notes}` returns Diagnosis |
| Prescription | `CreatePrescriptionInput {sessionId, items}` returns Prescription; preserve full item list |
| Active doctor work | `myActiveSession`, `session(id)`; no `myDoctor` or global doctor session-list query |
| Patient lookup | `patientByQrToken(token: ID!)`; short-lived token validated by backend |
| Pharmacy queue | `pendingPrescriptionItems(qrToken: ID!)`; patient demographics shown only if role permits lookup |
| Pharmacy catalog | `myPharmacy.drugPrices`, `setPharmacyDrugPrice`; no stock counts or expiry are invented |
| Wallet history | `wallet.transactions` with amount/direction/type; UI normalizes signs and labels |
| Hospital details | `myHospital` and doctors; hospital-wide session list is not exposed |

Live doctor records are the authorized patient QR/history and active session loaded in this tab. No arbitrary global patient directory is assumed. Reload restores the active session; a new patient lookup/QR may be needed to restore other opened records. Pharmacy scan caches expire locally, discard previous patient's data on a new successful scan, and are revalidated server-side. Frontend checks do not replace backend authorization.

Each actual HTTP operation handles an explicit authentication rejection independently. If a clinical mutation succeeds but the follow-up read needs token refresh, only that read is retried, preventing replay of a completed mutation.

## Authentication and routing

The actual backend exposes `requestOtp` → `verifyOtp`, then `refreshToken`. The UI accepts email, phone or username as an identifier, but validity and delivery rules belong to that backend. A password field cannot authenticate until the server exposes password auth. Live mode does not display the simulation account picker or quick demo button.

Roles returned by the server select the normal landing page: doctor `/dashboard`, pharmacist `/pharmacy`, patient `/portal`, administrator `/administration`. The local simulation uses OTP `000000`. Live mode uses the backend's OTP rules; no staff role is inferred from an email prefix.

Auth payloads are scoped to backend mode/endpoint in sessionStorage, validated on restoration and refreshed on explicit auth rejection. Sign out clears the active payload. Live and simulation records are not stored in the old browser-local `emerald-care-v1` dataset. Production session hardening should be agreed with the backend owner; this frontend currently retains bearer credentials in tab sessionStorage.

## Local simulation

Start `npm run mock:backend` in another terminal and select Simulation. This retains the complete appointments, profile, QR pairing, inventory, reports and connected payments workflow. The following sections document that provisional local extension and the future backend handoff; **they do not describe currently available live operations**.

## Unified workspace extension

These provisional additions make the original pages function against the mock service:

| Operation | Purpose |
| --- | --- |
| `myWorkspace: JSON!` | Authorized page data: patients, appointments, medicines, prescriptions, diagnoses, notes, profile, movements, sessions, wallet and payments |
| `workspaceAction(kind: WorkspaceAction!, input: JSON!): JSON!` | Validated write action; returns the resulting authorized snapshot |
| `workspaceChanged: Boolean!` | Invalidation signal; clients refetch their authorized snapshots |

Actions: `ADD_APPOINTMENT`, `UPDATE_APPOINTMENT`, `START_VISIT`, `ADD_DIAGNOSIS`, `ADD_PRESCRIPTION`, `SAVE_NOTE`, `SAVE_VITALS`, `SAVE_PROFILE`, `ADD_MEDICINE`, `RECEIVE_STOCK`, `DISPENSE`, `VERIFY_PATIENT`.

The JSON boundary is a deliberately provisional adapter for the existing page types. Replace it with backend-approved typed queries and inputs when the authoritative SDL becomes available. Server code validates the role, referenced resources and action values; arbitrary client state is never accepted or saved.

Scheduling enforces doctor ownership, practice hours and 30-minute overlaps. Starting a visit creates the same ACTIVE clinical session used by the original GraphQL operations. Clinical writes require that doctor's ACTIVE session. Completion invokes `finalizeSession`, debits the patient wallet, credits the hospital and completes the associated appointment. Finalized sessions reject further clinical writes.

Prescriptions stay unavailable to pharmacy dispensing until their session is FINALIZED. Serving invokes the existing dispensing engine, validates active patient access and the pharmacy's stock/expiry/price, then updates the patient/pharmacy wallets, prescription status, stock and medicine movement. Repeat finalization/dispensing is rejected before another charge. These operations are synchronous and atomic in this single-process mock; production needs durable transactions and idempotency keys.

In simulation, the normal views and the original clinical GraphQL mutations share the same patients, sessions, prescriptions, wallets and payments. Inventory is specific to the pharmacist account. Newly onboarded pharmacies start empty and add their own medicines. Doctor profile/availability changes are server-owned. Reports are calculated from the role-authorized server snapshot rather than browser-local seed data.

## Data access and updates

Doctors can access patients assigned through their appointments, their own clinical history, or an active approved pairing. Hospital administrators see their own doctors' patients and appointments. Pharmacists need either an approved pairing or a validated patient QR scan; the legacy scan grants two minutes. Patient records and pending items disappear from pharmacy snapshots after expiry/revocation. Existing legitimate clinical records/transactions remain intact.

`workspaceChanged` transmits only an invalidation boolean, never patient data. The client refetches with its own authorization. Reconnection, tab visibility changes and a 15-second fallback reconcile missed updates. A local expiry deadline clears pharmacy clinical data even if a refetch fails.

The seeded workspace is loaded once on mock-server startup from `mock/workspace.seed.json`. `lib/store.tsx` no longer reads/writes the old localStorage dataset. Data survives page reloads and is shared across tabs/devices that reach the same server; restarting the backend resets it.

## One-time login QR pairing

Staff display a QR; patients scan and approve it in `/portal`. Challenges expire after two minutes and can be consumed once. The resulting grant lasts 30 minutes. Creating a new staff QR revokes that provider's earlier waiting/approved connection. Both the provider and the patient can revoke access. One patient can independently connect to a doctor and a pharmacy.

| Operation | Authorized behavior |
| --- | --- |
| `createLoginQr` | DOCTOR/PHARMACY creates a challenge |
| `previewLoginQr(token)` | PATIENT reviews provider identity and expiry before consent |
| `approveLoginQr(token)` | PATIENT with complete profile consumes the challenge and approves |
| `pairingConnection(id)` / `myPairings` | Own connection status; shared records only while approved |
| `revokePairing(id)` | Owning staff account or linked patient ends sharing |
| `startPairedSession(connectionId)` | Owning DOCTOR starts a clinical session |
| `dispensePairedItem(connectionId, itemId)` | Owning PHARMACY serves only that connected patient's pending item |
| `pairingUpdated(connectionId)` | Owner-scoped approval, data-change and revocation notifications |

The URL is `/portal/#pair=<opaque-token>`. The fragment is removed from the address bar when captured; a pending link can be retained in sessionStorage through sign-in. Legacy `/simulation/#pair=...` links remain accepted. Tokens are hashed server-side and are not access/refresh tokens, patient IDs or medical information. Pairing approval does not impersonate either account or create a payment. Shared payment history includes only the provider's own charges.

Simulation statuses: `WAITING`, `APPROVED`, `REVOKED`, `EXPIRED`. Replay, replaced/cancelled codes, expiry, wrong roles and wrong owners are rejected by the backend. Client countdowns are presentation; the server decides validity.

## Physical phones

In live mode a phone needs only the HTTPS frontend: the server-side proxy reaches the remote backend. In simulation, the phone must also reach the mock service; its `localhost` is the phone itself. Use a reachable HTTPS mock endpoint in `NEXT_PUBLIC_SIMULATION_GRAPHQL_URL`, set `MOCK_SCAN_ORIGIN` to the frontend origin, include it in `MOCK_ALLOWED_ORIGINS`, and set `MOCK_HOST` if the mock must listen beyond loopback. The in-app camera requires HTTPS or localhost. Only expose the fixed-OTP seeded mock on a trusted development network.

## Validation and backend handoff

`npm run test:backend` checks original GraphQL contracts plus QR consent/replay/expiry/ownership, workspace role isolation, scheduling conflicts, clinical lifecycle, stock/wallet consistency, and pharmacy isolation. `npm run test:e2e` exercises the actual application pages, role routing, session reloads, OTP failure/refresh, mobile camera scanning, QR consent/revocation, staff onboarding, consultation-to-dispensing flow, reports, inventory and custom calendars.

To enable every simulation feature live, the backend must add/reconcile the missing operations and durable patient/session/stock/payment storage, proper OTP delivery, secure sessions, transactions/idempotency, audit history and aggregation/list APIs. Money uses Float ZAR amounts in this mock; confirm production money units/scalars. Stock currently has one expiry per medicine rather than batches. No real payment provider is integrated.
