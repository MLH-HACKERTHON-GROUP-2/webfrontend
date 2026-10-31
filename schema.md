# API Contract & Integration Guide (for frontend, to build in parallel)

This document pairs with [schema.graphql](schema.graphql) — the authoritative GraphQL SDL. Backend will implement resolvers against this exact schema; frontend can build UI against this schema today using a mock server (e.g. `graphql-tools` mocking, or Apollo MockedProvider / msw) without waiting on real endpoints. Any schema change goes through this file first.

## 1. Transport & Endpoints

- Single GraphQL endpoint: `POST /graphql` (queries + mutations)
- Single WS endpoint for subscriptions: `wss://<host>/graphql` using the `graphql-ws` protocol (same endpoint, upgraded)
- No REST endpoints, no separate Socket.IO gateway.

## 2. Auth

- Header: `Authorization: Bearer <accessToken>`
- Flow: `requestOtp({identifier})` → always succeeds, OTP is always `000000` in this environment → `verifyOtp({identifier, otp})` → returns `AuthPayload` (accessToken, refreshToken, user).
- Access token TTL: **15 minutes**. Refresh token TTL: **7 days**. Frontend implements silent refresh via `refreshToken` mutation on a 401/`UNAUTHENTICATED` error.
- WS connections authenticate via `connectionParams: { authorization: "Bearer <accessToken>" }` on connection init.
- First-time patient login: after `verifyOtp`, check `AuthPayload.user.profileComplete`. If `false`, route to the "complete your profile" screen before the main app; call `completePatientProfile` to set it `true`. All non-patient roles always have `profileComplete: true`.

## 3. Role → Landing Screen

| Role | Lands on |
|---|---|
| PATIENT | Home: QR code, wallet balance, session history |
| HOSPITAL_ADMIN | Hospital dashboard: doctor list, onboard doctor, hospital sessions, wallet |
| DOCTOR | Scan/lookup patient, active session workspace |
| PHARMACY | Scan/lookup patient, pending prescriptions, dispense, drug price list, wallet |
| SYSTEM_ADMIN | Admin dashboard: onboard hospital, onboard pharmacy, list of both |

## 4. Key Screen → Operation Mapping

### Patient app
- **Home / QR screen**: on screen open (and on tapping "Refresh"), call `mutation { generateQrToken { token qrCodeUrl expiresAt } }` and render `qrCodeUrl` as a QR. Token is valid **2 minutes** and is a *rotating* token — calling this again immediately invalidates the previous one, so don't call it speculatively/on a timer, only when the patient actually wants a fresh code. Show a countdown to `expiresAt` and prompt the patient to tap refresh once it's near/past expiry (no auto-polling in the PoC).
- **Top up wallet**: `mutation { topUpWallet(amount: X) { balance } }`
- **Session history**: `query { myPatientProfile { sessions { id status startedAt finalizedAt diagnosis { notes } prescription { items { drugName status } } } } }`
- **Live updates**: subscribe to `sessionStarted`, `sessionFinalized`, `prescriptionReady`, `prescriptionDispensed`, `myPaymentEvents` — drive toast/banner notifications.

### Doctor app
- **Scan patient QR**: decode URL `https://<host>/scan/{token}` → extract `token` → `query { patientByQrToken(token: $token) { ... } }` (shows full history per PoC decision). If expired, backend returns `TOKEN_EXPIRED` — surface as "ask patient to refresh their QR and rescan."
- **Start session**: `mutation { startSession(qrToken: $token) { id status } }` using the same scanned token (re-validated at call time) — only allowed if no other ACTIVE session exists for that patient (backend returns `SESSION_ALREADY_ACTIVE` if so — surface as "patient already in a session").
- **During session**: `recordVitals`, `recordDiagnosis`, `createPrescription` mutations, all keyed by `sessionId`. These are upserts — the doctor can call each repeatedly while the session is `ACTIVE` (e.g. editing vitals, adding more prescription items) and each call replaces the previous value; build the UI as a normal editable form, not a one-shot submit. They error `SESSION_NOT_ACTIVE` once finalized.
- **Finalize**: `mutation { finalizeSession(sessionId: $id) { status finalizedAt } }` — on error, surface `INSUFFICIENT_FUNDS` (see §5) distinctly ("ask patient to top up").

### Hospital admin app
- **Onboard doctor**: `mutation { onboardDoctor(input: {name, identifier}) { id user { name } } }`
- **Dashboard**: `query { myHospital { name consultationFee wallet { balance } doctors { id user { name } } } }`
- **Session list**: `query { hospitalSessions(status: FINALIZED) { ... } }`

### Pharmacy app
- **Scan patient**: decode same `{token}` from the QR → `query { pendingPrescriptionItems(qrToken: $token) { id drugName dosage quantity } }` — same `TOKEN_EXPIRED`/`TOKEN_NOT_FOUND` handling as doctor scan.
- **Set/maintain price list**: `mutation { setPharmacyDrugPrice(input: {drugName, price}) { drugName price } }`, list via `myPharmacy { drugPrices { drugName price } }`
- **Dispense**: `mutation { dispensePrescriptionItem(itemId: $id) { status dispensedAt } }` — if the drug has no price set yet in `drugPrices`, backend returns an error (`PRICE_NOT_SET`) — frontend should prompt the pharmacist to set it first.

### System admin app
- **Onboard hospital**: `mutation { onboardHospital(input: {name, address, consultationFee, adminName, adminIdentifier}) { id name } }`
- **Onboard pharmacy**: `mutation { onboardPharmacy(input: {name, address, userName, userIdentifier}) { id name } }`
- **Lists**: `allHospitals`, `allPharmacies`

## 5. Error Conventions

All mutation errors surface as standard GraphQL errors with an `extensions.code` for frontend branching:

| Code | Meaning | Where it can occur |
|---|---|---|
| `UNAUTHENTICATED` | Missing/expired token | any |
| `FORBIDDEN` | Wrong role or not resource owner | any role-gated field |
| `SESSION_ALREADY_ACTIVE` | Patient already has an ACTIVE session | `startSession` |
| `TOKEN_EXPIRED` | Scanned QR token's 2-minute TTL has passed | `patientByQrToken`, `pendingPrescriptionItems`, `startSession` |
| `TOKEN_NOT_FOUND` | Token doesn't exist (typo, or was rotated out by a newer `generateQrToken` call) | `patientByQrToken`, `pendingPrescriptionItems`, `startSession` |
| `SESSION_NOT_ACTIVE` | Trying to mutate a finalized session | `recordVitals`/`recordDiagnosis`/`createPrescription`/`finalizeSession` |
| `INSUFFICIENT_FUNDS` | Wallet balance too low | `finalizeSession`, `dispensePrescriptionItem` |
| `PRICE_NOT_SET` | Pharmacy hasn't set a price for this drug | `dispensePrescriptionItem` |
| `ALREADY_DISPENSED` | Item already dispensed by another pharmacy | `dispensePrescriptionItem` |
| `NOT_FOUND` | publicId / sessionId / itemId doesn't resolve | lookups |

Frontend should treat `INSUFFICIENT_FUNDS` and `PRICE_NOT_SET` as recoverable/actionable (show a specific CTA), everything else as a generic error toast.

## 6. Demo-Mode Notes (temporary, flagged for removal before any real deployment)

- OTP is always `000000` — login screens should still show a normal OTP input (6 digits) for demo realism, just don't wire up real SMS/email sending.
- Wallet top-up is instant and unconditional (`MockWalletProvider`) — no real payment form, just an amount input.

## 7. Resolved

All prior open items are now settled: profile-completion is signaled by `User.profileComplete`, session-recording mutations are upserts until finalize, and token TTLs are 15 min access / 7 day refresh. The contract is complete — frontend can build all screens against this document and [schema.graphql](schema.graphql) with no remaining ambiguity.
## 8. Proposed extension: one-time staff login QR pairing

Implemented in the **local simulation only**; the actual backend must adopt and validate these additional operations before deployment. See [INTEGRATION.md](INTEGRATION.md#one-time-login-qr-pairing) and [mock/schema.provisional.graphql](mock/schema.provisional.graphql).

A DOCTOR or PHARMACY creates a two-minute, single-use QR challenge (`createLoginQr`). The authenticated patient previews the requesting provider (`previewLoginQr`), then explicitly approves sharing (`approveLoginQr`). Approval creates a 30-minute connection; it does not transfer the patient's login credentials or make a payment. The patient's OTP login and first-profile completion still apply.

The provider and patient inspect their connection with `pairingConnection` / `myPairings` and receive updates through `pairingUpdated(connectionId)`. Either can call `revokePairing`. An approved doctor may use `startPairedSession`; an approved pharmacy may use `dispensePairedItem`. Each paired action checks provider ownership, patient identity, status and expiry on the server. Closed connections return no shared patient data. Existing clinical ownership and financial checks continue to apply.

Sharing includes patient information, medical records, pending prescriptions, wallet balance and payment activity with this provider. Consultation finalization and dispensing remain explicit charge actions. Staff QR regeneration cancels that provider's earlier connection. Codes contain only an opaque challenge, not patient records or bearer credentials. Replay, expiry and unauthorized access are rejected.

## 9. Unified main-workspace adapter (proposed local extension)

The normal application pages now use the same mock backend. `/simulation` redirects to the authenticated role's actual landing page; it is no longer a separate application.

The provisional SDL adds `myWorkspace: JSON!`, `workspaceAction(kind: WorkspaceAction!, input: JSON!): JSON!`, and `workspaceChanged: Boolean!`. These support server-owned scheduling, doctor profiles, structured clinical notes/diagnoses, pharmacy inventory/movement and authorized report datasets. They are local extensions, not operations established by the original guide. Backend-approved typed equivalents must replace/reconcile this JSON adapter before real integration.

See [INTEGRATION.md](INTEGRATION.md) for role scopes, transactions, the QR flow, session persistence and the backend handoff.


## 10. Supplied live backend (verified 2026-10-31)

The application defaults to `https://unstarched-maritally-ike.ngrok-free.dev/graphql` through a same-origin Next.js proxy. An introspected copy of its actual SDL is saved at [backend/schema.live.graphql](backend/schema.live.graphql). Its input types differ from the earlier local provisional schema; the live adapter uses those real types.

This endpoint currently has no subscription type and does not implement the local pairing or workspace extensions in sections 8–9. Those features remain in explicitly selected Simulation mode. Live authentication exposes identifier + OTP, not password login. See [INTEGRATION.md](INTEGRATION.md) for supported operations, type mappings, missing APIs and verification limits.
